# 붕붕 붕어빵 — Doosan E0509 제어용 ROS2 Humble 이미지
# RTX 노트북(Linux)에서 실행. 호스트 OS 버전과 상관없이 Ubuntu 22.04 + Humble 환경을 제공.
FROM osrf/ros:humble-desktop

ARG DRCF_VER=2
ENV DEBIAN_FRONTEND=noninteractive \
    ROS_DISTRO=humble \
    DSR_WS=/opt/dsr_ws \
    BOONG_WS=/root/boong_ws

# 두산 공식 매뉴얼 의존성 + rosbridge(웹 연동) + 네트워크 점검 도구 + docker CLI(에뮬레이터 실행용)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpoco-dev libyaml-cpp-dev wget git dbus-x11 python3-pip \
      iputils-ping netcat-openbsd iproute2 nano \
      ros-humble-control-msgs ros-humble-realtime-tools ros-humble-xacro \
      ros-humble-joint-state-publisher-gui ros-humble-ros2-control \
      ros-humble-ros2-controllers ros-humble-gazebo-msgs ros-humble-moveit-msgs \
      ros-humble-moveit-configs-utils ros-humble-moveit-ros-move-group \
      ros-humble-gazebo-ros-pkgs ros-humble-ros-gz-sim ros-humble-ign-ros2-control \
      ros-humble-rosbridge-suite \
      docker.io \
    && rm -rf /var/lib/apt/lists/*

# 두산 ROS2 드라이버 (humble 브랜치) → 언더레이 워크스페이스로 빌드
RUN mkdir -p ${DSR_WS}/src && cd ${DSR_WS}/src \
    && git clone --depth 1 -b humble https://github.com/doosan-robotics/doosan-robot2.git \
    && cd ${DSR_WS} \
    && apt-get update && (rosdep update || true) \
    && rosdep install -r --from-paths src --ignore-src --rosdistro ${ROS_DISTRO} -y \
    && rm -rf /var/lib/apt/lists/* \
    && . /opt/ros/${ROS_DISTRO}/setup.sh \
    && colcon build --cmake-args -DDRCF_VER=${DRCF_VER}

# 우리 패키지(boong_interfaces, boong_robot)는 볼륨으로 마운트해서 컨테이너 안에서 빌드
RUN mkdir -p ${BOONG_WS}/src \
    && echo "source /opt/ros/${ROS_DISTRO}/setup.bash" >> /root/.bashrc \
    && echo "source ${DSR_WS}/install/setup.bash" >> /root/.bashrc \
    && echo "[ -f ${BOONG_WS}/install/setup.bash ] && source ${BOONG_WS}/install/setup.bash" >> /root/.bashrc

WORKDIR /root
CMD ["sleep", "infinity"]
