from dataclasses import dataclass, field

@dataclass
class Solution:
    plan_type: str       # direct, split, longer, cross
    train_no: str
    segments: list[dict]
    total_price: float
    extra_fee: float
    priority: int = 1
    score: float = 0.0

def rank_solutions(solutions: list[Solution]) -> list[Solution]:
    """Rank solutions by priority: direct > same-train-split > longer > cross-train.
    Within same plan_type: lower price wins. Lower extra_fee breaks ties.
    """
    type_order = {"direct": 0, "split": 1, "longer": 2, "cross": 3}
    for s in solutions:
        s.priority = type_order.get(s.plan_type, 9)
        s.score = s.priority * 10000 + s.total_price * 10 + s.extra_fee
    solutions.sort(key=lambda s: s.score)
    return solutions
