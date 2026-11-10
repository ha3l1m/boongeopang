"""bungeoppang2 bake_sequence 명령 만들기 (ROS 없이 테스트 가능).

bake_sequence --serve 는 /bungeoppang/start_bake 에 "팥,슈크림@번호" 를 받아
틀 2개씩 굽고 /bungeoppang/bake_done 을 보낸다. @번호 = 꼬챙이·종이컵을 몇 번부터 쓸지(이미 나간 개수).
"""

# 우리 맛 이름(웹/액션) → bungeoppang2 의 맛 이름
FLAVOR_KO = {"redbean": "팥", "cream": "슈크림"}
# bungeoppang2 는 틀이 2개라 한 번에 2개씩 굽는다 (orchestrator_node.tick 과 같은 규칙)
MOLDS = 2


def bake_commands(flavor: str, qty: int) -> list[str]:
    """주문 한 건을 start_bake 명령 여러 개로 나눈다. 예: redbean x3 → ["팥,팥@0", "팥@2"]."""
    if flavor not in FLAVOR_KO:
        raise ValueError(f"지원하지 않는 맛: {flavor}")
    if qty < 1:
        raise ValueError(f"수량은 1개 이상이어야 해요: {qty}")
    name = FLAVOR_KO[flavor]
    commands = []
    served = 0
    left = qty
    while left > 0:
        n = min(MOLDS, left)
        commands.append(f"{','.join([name] * n)}@{served}")
        served += n
        left -= n
    return commands
