from calculator import divide


def test_divide():
    assert divide(6, 2) == 3


def test_divide_by_zero():
    try:
        divide(1, 0)
    except ValueError as error:
        assert str(error) == "cannot divide by zero"
    else:
        raise AssertionError("divide should reject zero")
