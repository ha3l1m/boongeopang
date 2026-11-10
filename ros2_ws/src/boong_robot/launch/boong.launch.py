"""붕봇 전체 실행: action 서버 + 주문 관리 (+ rosbridge)

# 터미널 1: 두산 드라이버 + RViz  (./robot.sh bringup)
# 터미널 2:
ros2 launch boong_robot boong.launch.py backend:=dsr      # 에뮬레이터/실제 로봇
ros2 launch boong_robot boong.launch.py backend:=mock     # 로봇 없이 (웹 개발)
"""
import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition, UnlessCondition
from launch.launch_description_sources import AnyLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory


def generate_launch_description():
    share = get_package_share_directory("boong_robot")
    backend = LaunchConfiguration("backend")
    poses = LaunchConfiguration("poses_file")
    rosbridge_xml = os.path.join(get_package_share_directory("rosbridge_server"), "launch", "rosbridge_websocket_launch.xml")
    return LaunchDescription([
        DeclareLaunchArgument("backend", default_value="mock", description="dsr | mock"),
        DeclareLaunchArgument("poses_file", default_value=os.path.join(share, "config", "poses.yaml")),
        DeclareLaunchArgument("rosbridge", default_value="true"),
        DeclareLaunchArgument("bungeoppang", default_value="false", description="true: bungeoppang2 bake_sequence 로 굽기 (robot_action_server 대신)"),
        Node(package="boong_robot", executable="robot_action_server", output="screen",
             parameters=[{"backend": backend, "poses_file": poses}],
             condition=UnlessCondition(LaunchConfiguration("bungeoppang"))),
        Node(package="boong_robot", executable="bungeoppang_bridge", output="screen",
             condition=IfCondition(LaunchConfiguration("bungeoppang"))),
        Node(package="boong_robot", executable="order_manager", output="screen"),
        IncludeLaunchDescription(AnyLaunchDescriptionSource(rosbridge_xml),
                                 launch_arguments={"port": "9090"}.items(),
                                 condition=IfCondition(LaunchConfiguration("rosbridge"))),
    ])
