"""그리퍼 방식별 동작 검증 (ROS 없이): ros_service 는 가짜 호출기로."""
from boong_robot.backends import MockBackend
from boong_robot.gripper import Gripper


class FakeCaller:
    def __init__(self):
        self.calls = []
        self.positions = []

    def call(self, name):
        self.calls.append(name)

    def set_position(self, pos):
        self.positions.append(pos)


def backend():
    return MockBackend(log=lambda *_: None, speed=0)


def test_ros_service_maps_grip_to_close_and_release_to_open():
    c = FakeCaller()
    g = Gripper(backend(), {"type": "ros_service"}, caller=c)
    g.release(); g.grip(); g.release()
    assert c.calls == ["open", "close", "open"]


def test_hold_and_squeeze_send_finger_positions():
    c = FakeCaller()
    g = Gripper(backend(), {"type": "ros_service"}, caller=c)
    g.hold(380)
    g.squeeze(520, 1.2, back_to=380)
    assert c.positions == [380, 520, 380]
    assert c.calls == []


def test_mock_never_calls_service():
    c = FakeCaller()
    g = Gripper(backend(), {"type": "mock"}, caller=c)
    g.grip(); g.release(); g.hold(380); g.squeeze(520, 1.2, back_to=380)
    assert c.calls == [] and c.positions == []


def test_digital_out_sets_pins_and_ignores_positions():
    b = backend()
    g = Gripper(b, {"type": "digital_out", "close": [[1, 1]], "open": [[1, 0]]})
    g.grip(); g.release(); g.hold(380); g.squeeze(520, 1.2, back_to=380)
    assert [c for c in b.calls if c[0] == "set_do"] == [("set_do", 1, 1), ("set_do", 1, 0)]
