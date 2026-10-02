from app.engine.sim import parse_tests, saw_timeout_marker


def test_parse_all_pass():
    stdout = "##TEST T1 PASS exp=00 got=00\n##TEST T2 PASS exp=ff got=ff\n##DONE\n"
    declared = {"T1": ("logic", "p1"), "T2": ("logic", "p2")}
    outcomes, saw_done = parse_tests(stdout, declared)
    assert saw_done is True
    assert {o.id: o.status for o in outcomes} == {"T1": "PASS", "T2": "PASS"}


def test_parse_mixed_results_preserves_exp_got():
    stdout = "##TEST T1 FAIL exp=00 got=b4\n##DONE\n"
    declared = {"T1": ("logic", "p1")}
    outcomes, _ = parse_tests(stdout, declared)
    assert outcomes[0].status == "FAIL"
    assert outcomes[0].exp == "00"
    assert outcomes[0].got == "b4"


def test_missing_test_line_becomes_uncertain():
    """Simulates a run that hung partway through; T2 never printed."""
    stdout = "##TEST T1 PASS exp=00 got=00\n##TIMEOUT\n"
    declared = {"T1": ("logic", "p1"), "T2": ("logic", "p2")}
    outcomes, saw_done = parse_tests(stdout, declared)
    by_id = {o.id: o.status for o in outcomes}
    assert by_id["T1"] == "PASS"
    assert by_id["T2"] == "UNCERTAIN"
    assert saw_done is False


def test_timeout_marker_detected():
    assert saw_timeout_marker("##TIMEOUT\n") is True
    assert saw_timeout_marker("##DONE\n") is False
