"""저속 동작 테스트: 현재 자세에서 J6만 +10° → -10° → 원위치.
큰 이동이 없어서 첫 연결 확인용으로 안전한 편. 실행 전 주변 정리, 비상정지 손에 쥐기."""
import os
import rclpy
import DR_init

ROBOT_ID = os.environ.get("ROBOT_ID", "dsr01")
ROBOT_MODEL = os.environ.get("ROBOT_MODEL", "e0509")
VEL, ACC = 10, 10  # deg/s, deg/s^2 — 저속

DR_init.__dsr__id = ROBOT_ID
DR_init.__dsr__model = ROBOT_MODEL


def main():
    rclpy.init()
    node = rclpy.create_node("boong_test_move", namespace=ROBOT_ID)
    DR_init.__dsr__node = node
    from DSR_ROBOT2 import get_current_posj, movej, posj

    start = list(get_current_posj())
    print(f"현재 관절각: {[round(v, 1) for v in start]}")
    for delta in (10, -10, 0):
        target = start[:5] + [start[5] + delta]
        print(f"→ J6 {delta:+d}°")
        movej(posj(*target), vel=VEL, acc=ACC)
    print("✓ 동작 확인 완료")
    rclpy.shutdown()


if __name__ == "__main__":
    main()
