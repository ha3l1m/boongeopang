"""붕봇 브리지: /boong/make_bungeoppang 액션을 받아 bungeoppang2 bake_sequence 로 굽는다.

order_manager 는 그대로 두고, robot_action_server 대신 이 노드가 같은 액션을 구현한다.
bake_sequence --serve 가 먼저 떠 있어야 한다 (/bungeoppang/start_bake 를 받아 굽고 /bungeoppang/bake_done 을 보냄).

  ros2 launch boong_robot boong.launch.py bungeoppang:=true
"""
import threading

import rclpy
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from std_msgs.msg import Bool, String

from boong_interfaces.action import MakeBungeoppang

from .bake_plan import FLAVOR_KO, bake_commands

BAKE_TIMEOUT_S = 600.0  # 한 판이 이 시간을 넘으면 실패로 본다


class BungeoppangBridge(Node):
    def __init__(self):
        super().__init__("bungeoppang_bridge")
        # 액션 실행(굽기 대기)과 bake_done 수신이 서로를 막지 않도록 재진입 그룹을 쓴다.
        self.cb = ReentrantCallbackGroup()
        self.start_pub = self.create_publisher(String, "/bungeoppang/start_bake", 10)
        self.create_subscription(Bool, "/bungeoppang/bake_done", self.on_done, 10, callback_group=self.cb)
        self.done = threading.Event()
        self.done_ok = False
        self.busy = threading.Lock()
        self._server = ActionServer(
            self, MakeBungeoppang, "/boong/make_bungeoppang",
            execute_callback=self.execute, goal_callback=self.on_goal,
            cancel_callback=lambda _: CancelResponse.ACCEPT, callback_group=self.cb,
        )
        self.get_logger().info("붕어빵 브리지 준비: /bungeoppang/start_bake → /bungeoppang/bake_done")

    def on_goal(self, goal):
        if goal.flavor not in FLAVOR_KO or goal.qty < 1:
            self.get_logger().warn(f"거절: flavor={goal.flavor} qty={goal.qty}")
            return GoalResponse.REJECT
        if self.busy.locked():
            self.get_logger().warn("거절: 이미 굽는 중 (order_manager가 순서대로 보내야 함)")
            return GoalResponse.REJECT
        return GoalResponse.ACCEPT

    def on_done(self, msg):
        self.done_ok = bool(msg.data)
        self.done.set()

    def bake_one(self, command: str) -> bool:
        """start_bake 한 번 보내고 bake_done 을 기다린다. 이전 완료 신호가 섞이지 않게 먼저 비운다."""
        self.done.clear()
        self.start_pub.publish(String(data=command))
        self.get_logger().info(f"🔥 굽기 명령: {command}")
        if not self.done.wait(BAKE_TIMEOUT_S):
            self.get_logger().error(f"시간 초과: {command}")
            return False
        return self.done_ok

    def execute(self, handle):
        goal = handle.request
        result = MakeBungeoppang.Result(order_id=goal.order_id)
        with self.busy:
            self.get_logger().info(f"🐟 주문 No.{goal.order_number} {goal.flavor} x{goal.qty} 시작")
            for command in bake_commands(goal.flavor, goal.qty):
                if handle.is_cancel_requested:
                    handle.canceled()
                    result.message = "취소됨"
                    return result
                # 명령 끝의 @번호 = 이미 나간 개수. 이 판에서 나갈 개수를 더해 몇 번째 붕어빵인지 정한다.
                served = int(command.rsplit("@", 1)[1])
                piece = served + command.count(",") + 1
                handle.publish_feedback(MakeBungeoppang.Feedback(
                    step="baking", detail=f"{command.split('@')[0]} 굽는 중",
                    piece_index=piece, progress=min(piece / goal.qty, 1.0),
                ))
                if not self.bake_one(command):
                    handle.abort()
                    result.success, result.message = False, "붕어빵 굽기에 실패했어요"
                    return result
        handle.publish_feedback(MakeBungeoppang.Feedback(step="ready", detail="픽업 대기", piece_index=goal.qty, progress=1.0))
        handle.succeed()
        result.success, result.message = True, "따끈할 때 가져가요!"
        self.get_logger().info(f"✅ 주문 No.{goal.order_number} 완료")
        return result


def main():
    rclpy.init()
    node = BungeoppangBridge()
    ex = MultiThreadedExecutor()
    ex.add_node(node)
    try:
        ex.spin()
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.try_shutdown()
