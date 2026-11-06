"""붕어빵 action 서버: /boong/make_bungeoppang

ros2 run boong_robot robot_action_server --ros-args -p backend:=dsr   # 에뮬레이터/실제 로봇
ros2 run boong_robot robot_action_server --ros-args -p backend:=mock  # 로봇 없이
"""
import os
import threading

import rclpy
from ament_index_python.packages import get_package_share_directory
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node

from boong_interfaces.action import MakeBungeoppang

from .backends import MockBackend
from .motions import FILLINGS, Bungeoppang
from .poses import load_poses
from .scene import Scene

STEP_PROGRESS = {"batter": 0.2, "filling": 0.4, "baking": 0.6, "packed": 0.85, "ready": 1.0}


def _ensure_dsr_path():
    """DR_init / DSR_ROBOT2 가 파이썬 경로에 없으면 두산 워크스페이스에서 찾아 추가."""
    import glob
    import sys
    try:
        import DR_init  # noqa: F401
        return
    except ImportError:
        pass
    ws = os.environ.get("DSR_WS", "/opt/dsr_ws")
    for f in glob.glob(f"{ws}/**/DR_init.py", recursive=True):
        sys.path.append(os.path.dirname(f))
        return
    raise ImportError(f"DR_init.py를 {ws}에서 못 찾음 — 두산 워크스페이스 빌드/ source 확인")


def make_dsr_backend(poses, robot_id, robot_model, log):
    """DSR_ROBOT2는 import 전에 DR_init에 전용 노드를 등록해야 함.
    이 노드는 executor에 넣지 않는다 (DSR 함수가 내부에서 직접 spin)."""
    _ensure_dsr_path()
    import DR_init
    DR_init.__dsr__id = robot_id
    DR_init.__dsr__model = robot_model
    dsr_node = rclpy.create_node("boong_dsr", namespace=robot_id)
    DR_init.__dsr__node = dsr_node
    from .backends import DsrBackend
    return DsrBackend(poses.get("speed", {}), log=log)


class RobotActionServer(Node):
    def __init__(self):
        super().__init__("boong_robot")
        default_poses = os.path.join(get_package_share_directory("boong_robot"), "config", "poses.yaml")
        self.declare_parameter("backend", "mock")
        self.declare_parameter("poses_file", default_poses)
        self.declare_parameter("robot_id", os.environ.get("ROBOT_ID", "dsr01"))
        self.declare_parameter("robot_model", os.environ.get("ROBOT_MODEL", "e0509"))
        g = lambda n: self.get_parameter(n).value  # noqa: E731

        self.poses = load_poses(g("poses_file"))
        self.scene = Scene(self, self.poses)
        log = self.get_logger().info
        if g("backend") == "dsr":
            self.backend = make_dsr_backend(self.poses, g("robot_id"), g("robot_model"), log)
        else:
            self.backend = MockBackend(log=self.get_logger().debug, speed=0.3)
        self.busy = threading.Lock()
        self._server = ActionServer(
            self, MakeBungeoppang, "/boong/make_bungeoppang",
            execute_callback=self.execute, goal_callback=self.on_goal, cancel_callback=lambda _: CancelResponse.ACCEPT,
        )
        self.get_logger().info(f"붕봇 준비 완료 (backend={g('backend')}, poses={g('poses_file')})")

    def on_goal(self, goal):
        if goal.flavor not in FILLINGS or goal.qty < 1:
            self.get_logger().warn(f"거절: flavor={goal.flavor} qty={goal.qty}")
            return GoalResponse.REJECT
        if self.busy.locked():
            self.get_logger().warn("거절: 이미 굽는 중 (order_manager가 순서대로 보내야 함)")
            return GoalResponse.REJECT
        return GoalResponse.ACCEPT

    def execute(self, handle):
        goal = handle.request
        result = MakeBungeoppang.Result(order_id=goal.order_id)
        with self.busy:
            self.get_logger().info(f"🐟 주문 No.{goal.order_number} {goal.flavor} x{goal.qty} 시작")
            for i in range(1, goal.qty + 1):
                def on_step(step, detail, i=i):
                    fb = MakeBungeoppang.Feedback(step=step, detail=detail, piece_index=i)
                    fb.progress = ((i - 1) + STEP_PROGRESS.get(step, 0.0)) / goal.qty
                    handle.publish_feedback(fb)
                    self.get_logger().info(f"  [{i}/{goal.qty}] {step}: {detail}")

                if handle.is_cancel_requested:
                    handle.canceled()
                    result.message = "취소됨"
                    return result
                try:
                    Bungeoppang(self.backend, self.poses, on_step, self.scene).make_one(goal.flavor)
                except Exception as e:  # 로봇 에러 → 주문 실패로 보고
                    self.get_logger().error(f"동작 실패: {e}")
                    handle.abort()
                    result.success, result.message = False, str(e)
                    return result
            handle.publish_feedback(MakeBungeoppang.Feedback(step="ready", detail="픽업 대기", piece_index=goal.qty, progress=1.0))
        handle.succeed()
        result.success, result.message = True, "따끈할 때 가져가요!"
        self.get_logger().info(f"✅ 주문 No.{goal.order_number} 완료")
        return result


def main():
    rclpy.init()
    node = RobotActionServer()
    ex = MultiThreadedExecutor()
    ex.add_node(node)
    try:
        ex.spin()
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.try_shutdown()
