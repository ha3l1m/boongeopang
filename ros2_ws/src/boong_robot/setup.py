from glob import glob
from setuptools import find_packages, setup

package_name = "boong_robot"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/config", glob("config/*")),
        ("share/" + package_name + "/launch", glob("launch/*.py")),
    ],
    install_requires=["setuptools", "pyyaml"],
    zip_safe=True,
    entry_points={
        "console_scripts": [
            "robot_action_server = boong_robot.robot_action_server:main",
            "order_manager = boong_robot.order_manager:main",
            "run_sequence = boong_robot.run_sequence:main",
        ],
    },
)
