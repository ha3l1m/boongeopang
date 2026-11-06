"""붕어빵 동작 시퀀스 (ROS 의존성 없음 → 로봇 없이 테스트 가능).

재료(반죽·팥·슈크림)는 말랑한 소스통에 담겨 있다. 로봇은 통을 옆에서 집어 틀 위로 옮기고,
6축 손목(J6)을 180° 돌려 노즐을 아래로 향하게 한 뒤, 그리퍼를 더 닫아서 짠다.
세기는 재료마다 다르다 → poses.yaml 의 materials (점성이 높을수록 더 닫고 더 오래 누른다).

1 pour_batter    반죽 통 → 틀 위에서 뒤집어 짜기 → 다시 세워 제자리
2 add_filling    팥/슈크림 통으로 같은 동작
3 cover_filling  반죽 통으로 한 번 더 (앙금 덮기)
4 wait_bake      굽기 대기
5 flip_mold      틀 손잡이 집기 → 들어올림 → J6 180° → 내려놓기 → 대기
6 pick_to_bag    붕어빵 집기 → 봉투 위 → 놓기
"""
from typing import Callable

from .gripper import Gripper
from .poses import above, approach, spun

FILLINGS = ("redbean", "cream")

# 웹앱 단계 이름과 동일: received → batter → filling → baking → packed → ready
StepCb = Callable[[str, str], None]  # (step, detail)


def _noop(step: str, detail: str) -> None:
    pass


class Bungeoppang:
    def __init__(self, backend, poses: dict, on_step: StepCb = _noop, scene=None):
        self.b = backend
        self.p = poses
        self.on_step = on_step
        self.scene = scene  # RViz 마커 (없으면 생략)
        self.dz = poses.get("approach_z", 100)
        self.gripper = Gripper(backend, poses.get("gripper", {}))

    # ---- 공통 -------------------------------------------------------------
    def _x(self, name):
        return self.p[name]["posx"]

    def home(self):
        self.b.home(self.p["home"]["posj"])

    def _down_up(self, target, action):
        """접근점(툴 반대쪽으로 물러난 점) → 목표 → action() → 다시 물러나기"""
        self.b.move_line(approach(target, self.dz))
        self.b.move_line(target)
        action()
        self.b.move_line(approach(target, self.dz))

    def _scene(self, state, flavor=None):
        if self.scene:
            self.scene.set_state(state, flavor)

    # ---- 소스통 짜기 ------------------------------------------------------
    def _dispense(self, material: str):
        m = self.p["materials"][material]
        bottle = self._x(m["bottle"])
        dst = self._x("mold_dispense")
        lift = self.p.get("bottle_lift_mm", 150)
        clear = self.p.get("flip_clear_mm", 100)

        # 1) 통 집기: 옆에서 접근 → 가볍게 잡기 → 들어올리기
        self.gripper.release()
        self.b.move_line(approach(bottle, self.dz))
        self.b.move_line(bottle)
        self.gripper.hold(m["hold"])
        self.b.move_line(above(bottle, lift))
        # 2) 틀 위로 가서 손목을 돌려 노즐을 아래로
        self.b.move_line(above(dst, clear))
        self.b.rotate_j6(180)
        down = spun(dst, 180)  # 손목이 180° 돈 자세 그대로 내려가기
        self.b.move_line(down)
        # 3) 짜기: 더 닫고 누르고, 다시 잡기 위치로
        self.gripper.squeeze(m["squeeze"], m["squeeze_sec"], back_to=m["hold"])
        # 4) 올라와서 통을 다시 세우기
        self.b.move_line(above(down, clear))
        self.b.rotate_j6(-180)
        # 5) 제자리에 내려놓기
        self.b.move_line(above(bottle, lift))
        self.b.move_line(bottle)
        self.gripper.release()
        self.b.move_line(approach(bottle, self.dz))

    # ---- 동작 -------------------------------------------------------------
    def pour_batter(self):
        self.on_step("batter", "반죽 짜는 중")
        self._dispense("batter")
        self._scene("batter")

    def add_filling(self, flavor: str):
        if flavor not in FILLINGS:
            raise ValueError(f"모르는 맛: {flavor}")
        self.on_step("filling", "앙금 짜는 중")
        self._dispense(flavor)
        self._scene("filling", flavor)

    def cover_filling(self):
        self.on_step("filling", "반죽으로 덮는 중")
        self._dispense("batter")
        self._scene("covered")

    def wait_bake(self, sec=None):
        self.on_step("baking", "굽는 중")
        self.b.wait(self.p.get("bake_sec", 3.0) if sec is None else sec)
        self._scene("baked")

    def flip_mold(self):
        self.on_step("baking", "틀 뒤집는 중")
        handle = self._x("mold_handle")
        lift = above(handle, self.p.get("flip_lift_mm", 120))
        self.gripper.release()
        self.b.move_line(approach(handle, self.dz))
        self.b.move_line(handle)
        self.gripper.grip()
        self.b.move_line(lift)
        self.b.rotate_j6(180)
        self._scene("flipped")
        # 손목이 180° 돈 자세 그대로 내려놓기 (c+180) — 원래 자세로 movel 하면 회전이 풀림
        flipped = spun(handle, 180)
        self.b.move_line(flipped)
        self.gripper.release()
        self.b.move_line(approach(flipped, self.dz))
        self.b.wait(self.p.get("flip_bake_sec", 3.0))

    def pick_to_bag(self):
        self.on_step("packed", "봉투에 담는 중")
        self.gripper.release()
        self._down_up(self._x("bread_pick"), self.gripper.grip)
        bag = self._x("bag_drop")
        self.b.move_line(approach(bag, self.dz))
        self.b.move_line(bag)
        self.gripper.release()  # 떨어뜨리기
        self._scene("bagged")
        self.b.move_line(approach(bag, self.dz))

    # ---- 붕어빵 1개 전체 --------------------------------------------------
    def make_one(self, flavor: str):
        self._scene("empty")
        self.home()
        self.pour_batter()
        self.add_filling(flavor)
        self.cover_filling()
        self.wait_bake()
        self.flip_mold()
        self.pick_to_bag()
        self.home()
