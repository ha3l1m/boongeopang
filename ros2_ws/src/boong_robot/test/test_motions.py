"""로봇·ROS 없이 동작 순서 검증: pytest ros2_ws/src/boong_robot/test"""
from pathlib import Path

import pytest

from boong_robot.backends import MockBackend
from boong_robot.gripper import Gripper
from boong_robot.motions import Bungeoppang
from boong_robot.poses import above, approach, load_poses, spun

POSES = load_poses(Path(__file__).parents[1] / "config" / "poses.yaml")
MAT = POSES["materials"]


class FakeCaller:
    """그리퍼 서비스/토픽 호출을 백엔드 기록(calls)에 섞어 넣어 순서를 검증한다."""

    def __init__(self, backend):
        self.b = backend

    def call(self, name):
        self.b.calls.append(("grip_srv", name))

    def set_position(self, pos):
        self.b.calls.append(("pos", pos))


def make():
    b = MockBackend(log=lambda *_: None, speed=0)
    steps = []
    bot = Bungeoppang(b, {**POSES, "gripper": {"type": "mock"}}, on_step=lambda s, d: steps.append(s))
    bot.gripper = Gripper(b, {"type": "ros_service"}, caller=FakeCaller(b))
    return bot, b, steps


def movels(calls):
    return [c[1] for c in calls if c[0] == "movel"]


def f(pose):
    return tuple(round(v, 1) for v in pose)


def test_web_steps_in_order():
    bot, _, steps = make()
    bot.make_one("redbean")
    assert steps == ["batter", "filling", "filling", "baking", "baking", "packed"]


def test_starts_and_ends_at_home():
    bot, b, _ = make()
    bot.make_one("redbean")
    assert b.calls[0][0] == "home" and b.calls[-1][0] == "home"


def test_dispense_inverts_then_restores_bottle():
    bot, b, _ = make()
    bot.pour_batter()
    assert [c for c in b.calls if c[0] == "rotate_j6"] == [("rotate_j6", 180), ("rotate_j6", -180)]


def test_squeeze_happens_while_bottle_is_upside_down():
    bot, b, _ = make()
    bot.pour_batter()
    i, j = b.calls.index(("rotate_j6", 180)), b.calls.index(("rotate_j6", -180))
    assert ("pos", MAT["batter"]["squeeze"]) in b.calls[i:j]
    assert ("pos", MAT["batter"]["squeeze"]) not in b.calls[:i] + b.calls[j:]


def test_lowers_over_mold_with_rotated_wrist():
    bot, b, _ = make()
    bot.pour_batter()
    i = b.calls.index(("rotate_j6", 180))
    nxt = next(c for c in b.calls[i + 1:] if c[0] == "movel")
    assert nxt[1] == f(spun(POSES["mold_dispense"]["posx"], 180))


def test_bottle_is_approached_from_the_side():
    bot, b, _ = make()
    bot.pour_batter()
    first = movels(b.calls)[0]
    bottle = POSES["batter_bottle"]["posx"]
    assert first[1] == bottle[1] + POSES["approach_z"]  # 툴이 -y를 향하므로 +y 쪽에서 접근
    assert first[2] == bottle[2]  # 높이는 그대로 (위에서 내려오지 않는다)


def test_squeezes_in_order_batter_filling_cover():
    bot, b, _ = make()
    bot.make_one("redbean")
    squeezes = {MAT[k]["squeeze"] for k in MAT}
    positions = [c[1] for c in b.calls if c[0] == "pos" and c[1] in squeezes]
    assert positions == [MAT["batter"]["squeeze"], MAT["redbean"]["squeeze"], MAT["batter"]["squeeze"]]


def test_thicker_material_is_squeezed_harder_and_longer():
    assert MAT["redbean"]["squeeze"] >= MAT["batter"]["squeeze"]
    assert MAT["redbean"]["squeeze_sec"] >= MAT["batter"]["squeeze_sec"]
    for m in MAT.values():
        assert m["squeeze"] > m["hold"]


def test_cream_uses_cream_bottle():
    bot, b, _ = make()
    bot.add_filling("cream")
    assert f(POSES["cream_bottle"]["posx"]) in movels(b.calls)
    assert f(POSES["redbean_bottle"]["posx"]) not in movels(b.calls)


def test_flip_mold_rotates_180_once_and_lowers_spun():
    bot, b, _ = make()
    bot.flip_mold()
    assert [c for c in b.calls if c[0] == "rotate_j6"] == [("rotate_j6", 180)]
    i = b.calls.index(("rotate_j6", 180))
    nxt = next(c for c in b.calls[i + 1:] if c[0] == "movel")
    assert nxt[1][5] == POSES["mold_handle"]["posx"][5] + 180


def test_handle_is_approached_along_tool_axis():
    bot, b, _ = make()
    bot.flip_mold()
    first = movels(b.calls)[0]
    handle = POSES["mold_handle"]["posx"]
    assert first[1] == handle[1] + POSES["approach_z"] and first[2] == handle[2]


def test_full_sequence_gripper_usage():
    bot, b, _ = make()
    bot.make_one("redbean")
    assert b.calls.count(("grip_srv", "close")) == 2  # 틀 손잡이, 붕어빵
    holds = [c[1] for c in b.calls if c[0] == "pos" and c[1] == MAT["batter"]["hold"]]
    assert len(holds) >= 3
    assert b.calls[[i for i, c in enumerate(b.calls) if c[0] == "grip_srv"][-1]] == ("grip_srv", "open")


def test_approach_equals_above_for_tool_pointing_down():
    p = [400, 0, 100, 0, 180, 0]
    assert [round(v, 3) for v in approach(p, 100)] == above(p, 100)


def test_approach_retreats_sideways_for_horizontal_tool():
    p = [470, 180, 110, -90, 90, 0]
    assert approach(p, 100)[:3] == [470.0, 280.0, 110.0]


def test_unknown_flavor():
    bot, _, _ = make()
    with pytest.raises(ValueError):
        bot.add_filling("choco")
