"""RViz 마커: 틀·소스통·봉투·붕어빵을 /boong/scene (MarkerArray)으로 표시."""
from visualization_msgs.msg import Marker, MarkerArray

BROWN = (0.55, 0.29, 0.17)
FLAVOR_COLOR = {"redbean": (0.55, 0.29, 0.17), "cream": (0.96, 0.85, 0.54)}
BATTER = (0.98, 0.92, 0.75)
GOLD = (0.96, 0.65, 0.14)
BOTTLES = [("batter", "반죽", BATTER), ("redbean", "팥", FLAVOR_COLOR["redbean"]), ("cream", "슈크림", FLAVOR_COLOR["cream"])]


class Scene:
    def __init__(self, node, poses: dict, topic="/boong/scene"):
        self.node = node
        self.p = poses
        self.frame = poses.get("scene_frame", "base_link")
        self.pub = node.create_publisher(MarkerArray, topic, 10)
        self.state, self.flavor = "empty", None
        node.create_timer(0.5, self.publish)

    def set_state(self, state, flavor=None):
        self.state = state
        if flavor:
            self.flavor = flavor
        self.publish()

    def _xyz(self, name, dz=0.0):
        x, y, z = self.p[name]["posx"][:3]
        return x / 1000.0, y / 1000.0, (z + dz) / 1000.0

    def _m(self, mid, shape, xyz, scale, rgb, alpha=1.0, text=""):
        m = Marker()
        m.header.frame_id = self.frame
        m.header.stamp = self.node.get_clock().now().to_msg()
        m.ns, m.id, m.type, m.action = "boong", mid, shape, Marker.ADD
        m.pose.position.x, m.pose.position.y, m.pose.position.z = xyz
        m.pose.orientation.w = 1.0
        m.scale.x, m.scale.y, m.scale.z = scale
        m.color.r, m.color.g, m.color.b = rgb
        m.color.a = alpha
        m.text = text
        return m

    def publish(self):
        arr = MarkerArray()
        mx, my, _ = self._xyz("mold_dispense")
        mold_z = 0.11
        arr.markers.append(self._m(0, Marker.CUBE, (mx, my, mold_z), (0.22, 0.16, 0.04), (0.25, 0.25, 0.28)))
        hx, hy, hz = self._xyz("mold_handle")
        arr.markers.append(self._m(1, Marker.CYLINDER, (hx, hy, hz), (0.03, 0.03, 0.12), (0.15, 0.15, 0.15)))
        # 소스통: 세워 둔 병 모양 (높이 18cm)
        for i, (mat, label, rgb) in enumerate(BOTTLES):
            bx_, by_, _ = self._xyz(self.p["materials"][mat]["bottle"])
            arr.markers.append(self._m(10 + i, Marker.CYLINDER, (bx_, by_, 0.09), (0.07, 0.07, 0.18), rgb, 0.9))
            arr.markers.append(self._m(20 + i, Marker.TEXT_VIEW_FACING, (bx_, by_, 0.24), (0, 0, 0.04), (1, 1, 1), text=label))
        bx, by, _ = self._xyz("bag_drop")
        arr.markers.append(self._m(30, Marker.CUBE, (bx, by, 0.08), (0.14, 0.10, 0.16), (0.91, 0.81, 0.64), 0.8))
        arr.markers.append(self._m(31, Marker.TEXT_VIEW_FACING, (bx, by, 0.2), (0, 0, 0.04), (1, 1, 1), text="봉투"))

        # 붕어빵 상태
        at_mold = (mx, my, mold_z + 0.03)
        bread = {
            "empty": None,
            "batter": (at_mold, BATTER),
            "filling": (at_mold, FLAVOR_COLOR.get(self.flavor, BROWN)),
            "covered": (at_mold, BATTER),
            "baked": (at_mold, GOLD),
            "flipped": (at_mold, GOLD),
            "bagged": ((bx, by, 0.12), GOLD),
        }.get(self.state)
        m = self._m(40, Marker.SPHERE, bread[0] if bread else (0, 0, 0), (0.12, 0.06, 0.03), bread[1] if bread else GOLD)
        if not bread:
            m.action = Marker.DELETE
        arr.markers.append(m)
        arr.markers.append(self._m(41, Marker.TEXT_VIEW_FACING, (mx, my, 0.35), (0, 0, 0.05), (1, 1, 0.6), text=f"붕봇: {self.state}"))
        self.pub.publish(arr)
