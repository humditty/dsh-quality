def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("cannot divide by zero")
    return a / b
