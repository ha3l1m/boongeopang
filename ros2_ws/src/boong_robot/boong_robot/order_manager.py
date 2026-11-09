"""주문 관리: 선입선출 Queue → action 서버에 1건씩 전달, 현황을 /boong/orders(JSON)로 발행.

웹앱(rosbridge) →  /boong/submit_order (srv)
웹앱 구독      ←  /boong/orders (std_msgs/String, JSON 배열)
"""
import json
import time
import uuid
from collections import deque

import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from std_msgs.msg import String

from boong_interfaces.action import MakeBungeoppang
from boong_interfaces.srv import SubmitOrder

KEEP_DONE = 20


class OrderManager(Node):
    def __init__(self):
        super().__init__("boong_order_manager")
        self.queue: deque[dict] = deque()
        self.current: dict | None = None
        self.done: deque[dict] = deque(maxlen=KEEP_DONE)
        self.pub = self.create_publisher(String, "/boong/orders", 10)
        self.create_service(SubmitOrder, "/boong/submit_order", self.on_submit)
        self.client = ActionClient(self, MakeBungeoppang, "/boong/make_bungeoppang")
        self.create_timer(0.5, self.tick)
        self.create_timer(1.0, self.publish)
        self.get_logger().info("주문 관리 시작: /boong/submit_order 대기 중")

    # ---- 주문 받기 --------------------------------------------------------
    def on_submit(self, req, res):
        if req.flavor not in ("redbean", "cream") or req.qty < 1:
            res.accepted, res.message = False, "단팥(redbean) / 슈크림(cream), 1개 이상만 가능해요"
            return res
        # 응답이 유실돼 웹이 다시 보내도 두 번 굽지 않게. 실패한 건은 재전송을 받는다.
        known = [*([self.current] if self.current else []), *self.queue, *self.done]
        if req.order_id and any(
            o["order_id"] == req.order_id and o["flavor"] == req.flavor and o["state"] != "failed" for o in known
        ):
            res.accepted, res.message = True, "이미 접수된 주문"
            return res
        order = {
            "order_id": req.order_id or str(uuid.uuid4()),
            "number": req.order_number,
            "flavor": req.flavor,
            "qty": req.qty,
            "state": "waiting",
            "step": "received",
            "detail": "",
            "progress": 0.0,
            "created_at": time.time(),
        }
        self.queue.append(order)
        res.accepted = True
        res.queue_position = len(self.queue) - (0 if self.current else 1)
        res.message = f"주문 접수 (대기 {res.queue_position})"
        self.get_logger().info(f"📥 No.{order['number']} {order['flavor']} x{order['qty']} → {res.message}")
        self.publish()
        return res

    # ---- 1건씩 굽기 -------------------------------------------------------
    def tick(self):
        if self.current or not self.queue:
            return
        if not self.client.server_is_ready():
            return
        self.current = self.queue.popleft()
        o = self.current
        o["state"] = "baking"
        goal = MakeBungeoppang.Goal(order_id=o["order_id"], order_number=o["number"], flavor=o["flavor"], qty=o["qty"])
        fut = self.client.send_goal_async(goal, feedback_callback=self.on_feedback)
        fut.add_done_callback(self.on_goal_response)

    def on_feedback(self, msg):
        if self.current:
            fb = msg.feedback
            self.current.update(step=fb.step, detail=fb.detail, progress=round(fb.progress, 2), piece=fb.piece_index)

    def on_goal_response(self, fut):
        handle = fut.result()
        if not handle.accepted:
            self.get_logger().warn("로봇이 주문을 거절 → 다시 대기열 앞으로")
            self.current["state"] = "waiting"
            self.queue.appendleft(self.current)
            self.current = None
            return
        handle.get_result_async().add_done_callback(self.on_result)

    def on_result(self, fut):
        res = fut.result().result
        o = self.current
        o["state"] = "done" if res.success else "failed"
        o["step"] = "ready" if res.success else o["step"]
        o["detail"] = res.message
        self.done.appendleft(o)
        self.current = None
        self.get_logger().info(f"{'✅' if res.success else '❌'} No.{o['number']} {res.message}")
        self.publish()

    # ---- 현황 -------------------------------------------------------------
    def publish(self):
        rows = []
        if self.current:
            rows.append({**self.current, "queue_position": 0})
        for i, o in enumerate(self.queue, start=1):
            rows.append({**o, "queue_position": i})
        rows += [{**o, "queue_position": -1} for o in self.done]
        self.pub.publish(String(data=json.dumps(rows, ensure_ascii=False)))


def main():
    rclpy.init()
    node = OrderManager()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.try_shutdown()
