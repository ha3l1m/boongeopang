"""bungeoppang2 bake_sequence 명령 생성 검증 (ROS 없이): pytest ros2_ws/src/boong_robot/test"""
import pytest

from boong_robot.bake_plan import bake_commands


def test_single_piece_uses_one_mold_from_zero():
    assert bake_commands("redbean", 1) == ["팥@0"]


def test_pairs_two_molds_per_bake_and_counts_served():
    assert bake_commands("redbean", 3) == ["팥,팥@0", "팥@2"]


def test_cream_maps_to_슈크림():
    assert bake_commands("cream", 2) == ["슈크림,슈크림@0"]


def test_rejects_unknown_flavor_and_empty_qty():
    with pytest.raises(ValueError):
        bake_commands("choco", 1)
    with pytest.raises(ValueError):
        bake_commands("redbean", 0)
