import sqlite3

from scripts.seed_interview_emails import EMAILS, seed


def test_seed_is_additive_and_preserves_reader_progress(tmp_path):
    path = tmp_path / 'mail.db'
    with sqlite3.connect(path) as conn:
        conn.execute('CREATE TABLE emails (id TEXT PRIMARY KEY, subject TEXT, sender TEXT, date TEXT, body TEXT, folder TEXT, analysis_status TEXT)')
        conn.execute("INSERT INTO emails (id,body) VALUES ('existing','keep me')")
    assert seed(path) == 18
    with sqlite3.connect(path) as conn:
        conn.execute("UPDATE emails SET analysis_status='processed' WHERE id='interview-v1-paper'")
        before = conn.execute('SELECT * FROM emails ORDER BY id').fetchall()
    assert seed(path) == 0
    with sqlite3.connect(path) as conn:
        assert conn.execute('SELECT * FROM emails ORDER BY id').fetchall() == before
    assert len({row[0] for row in EMAILS}) == 18
    assert all('example.com' in row[1] for row in EMAILS)
