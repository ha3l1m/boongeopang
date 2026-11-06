"""동작 하나씩 / 전체 테스트 (action 없이 바로 실행). 토요일 티칭 때 사용.

ros2 run boong_robot run_sequence --ros-args -p step:=pour_batter -p backend:=dsr
step: home | pour_batter | add_filling | cover_filling | wait_bake | flip_mold | pick_to_bag | all
"""
import os

import rclpy
from ament_index_python.packages import get_package_share_directory

from .backends import MockBackend
from .motions import Bungeoppang
from .poses import load_poses
from .robot_action_server import make_dsr_backend


def main():
    rclpy.init()
    node = rclpy.create_node("boong_run_sequence")
    default_poses = os.path.join(get_package_share_directory("boong_robot"), "config", "poses.yaml")
    for name, val in [("backend", "dsr"), ("step", "all"), ("flavor", "redbean"), ("poses_file", default_poses),
                      ("robot_id", os.environ.get("ROBOT_ID", "dsr01")), ("robot_model", os.environ.get("ROBOT_MODEL", "e0509"))]:
        node.declare_parameter(name, val)
    g = lambda n: node.get_parameter(n).value  # noqa: E731
    poses = load_poses(g("poses_file"))
    log = node.get_logger().info
    backend = make_dsr_backend(poses, g("robot_id"), g("robot_model"), log) if g("backend") == "dsr" else MockBackend(log=log)
    bot = Bungeoppang(backend, poses, on_step=lambda s, d: log(f"▶ {s}: {d}"))
    step = g("step")
    log(f"실행: {step}")
    if step == "all":
        bot.make_one(g("flavor"))
    elif step == "add_filling":
        bot.add_filling(g("flavor"))
    else:
        getattr(bot, step)()
    log("완료")
    node.destroy_node()
    rclpy.try_shutdown()
