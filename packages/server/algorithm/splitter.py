def split_same_train(stops: list[dict], from_code: str, to_code: str) -> list[list[dict]]:
    """Generate same-train transfer combinations from full route stops.

    Args:
        stops: Full stop list from 12306 schedule API.
               Each stop has: station_name, station_train_code (telecode), arrive_time, start_time.
        from_code: Departure station telecode (e.g. 'SHH').
        to_code: Destination station telecode (e.g. 'BJP').

    Returns:
        List of segment groups. Each group = list of segment dicts (1 for direct, 2+ for split).
        Segment: {from_station, to_station, from_time, to_time, train_no, is_empty: bool}.
    """
    from_idx = None
    to_idx = None
    for i, s in enumerate(stops):
        if s.get("station_train_code") == from_code or s.get("station_name") == from_code:
            from_idx = i
        if s.get("station_train_code") == to_code or s.get("station_name") == to_code:
            to_idx = i

    if from_idx is None or to_idx is None or from_idx >= to_idx:
        return []

    train_no = stops[0].get("station_train_code", "")
    groups: list[list[dict]] = []

    # Direct: [from -> to]
    groups.append([_make_segment(stops[from_idx], stops[to_idx], train_no)])

    # Same-train split: [from -> mid] + [mid -> to] for each intermediate stop
    for mid in range(from_idx + 1, to_idx):
        g1 = _make_segment(stops[from_idx], stops[mid], train_no)
        g2 = _make_segment(stops[mid], stops[to_idx], train_no)
        groups.append([g1, g2])

    return groups


def _make_segment(from_stop: dict, to_stop: dict, train_no: str) -> dict:
    return {
        "from_station": from_stop.get("station_train_code", from_stop.get("station_name", "")),
        "to_station": to_stop.get("station_train_code", to_stop.get("station_name", "")),
        "from_time": from_stop.get("start_time", ""),
        "to_time": to_stop.get("arrive_time", ""),
        "train_no": train_no,
        "is_empty": False,
    }
