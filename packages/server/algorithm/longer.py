def find_longer_options(stops: list[dict], from_code: str, to_code: str,
                        direct_price: float, max_extra: int = 30) -> list[dict]:
    """Find 'buy longer, ride shorter' options within the extra fee budget.

    Args:
        stops: Full stop list from schedule API (same format as splitter).
        from_code: User's actual departure station.
        to_code: User's actual destination station.
        direct_price: Price of the A->D ticket (may be 0 if unchecked).
        max_extra: Maximum extra fee allowed (元).

    Returns:
        List of longer-segment options, each with from/to station and extra fee.
    """
    to_idx = None
    for i, s in enumerate(stops):
        if s.get("station_train_code") == to_code or s.get("station_name") == to_code:
            to_idx = i
    if to_idx is None:
        return []

    train_no = stops[0].get("station_train_code", "")
    from_stop = None
    for s in stops:
        if s.get("station_train_code") == from_code or s.get("station_name") == from_code:
            from_stop = s
            break
    if not from_stop:
        return []

    options = []
    for dest_stop in stops[to_idx + 1:]:
        extra = dest_stop.get("price", 0) - direct_price if direct_price else 999
        if extra <= max_extra:
            options.append({
                "from_station": from_stop.get("station_train_code", from_code),
                "to_station": dest_stop.get("station_train_code", ""),
                "train_no": train_no,
                "extra_fee": max(extra, 0),
                "full_price": dest_stop.get("price", 0),
            })
    return options
