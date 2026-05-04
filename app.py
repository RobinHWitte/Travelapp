import sqlite3
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = 'dev-secret-change-me'
DB_PATH = Path('travelapp.db')


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                route_name TEXT NOT NULL,
                points_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            '''
        )


@app.route('/')
def index() -> str:
    return render_template('index.html')


@app.route('/api/register', methods=['POST'])
def register():
    payload = request.get_json(force=True)
    name = payload.get('name', '').strip()
    email = payload.get('email', '').strip().lower()
    password = payload.get('password', '')

    if not name or not email or len(password) < 6:
        return jsonify({'error': 'Ungültige Eingaben. Passwort mindestens 6 Zeichen.'}), 400

    with get_db() as conn:
        try:
            conn.execute(
                'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                (name, email, generate_password_hash(password)),
            )
            user = conn.execute('SELECT id, name, email FROM users WHERE email = ?', (email,)).fetchone()
        except sqlite3.IntegrityError:
            return jsonify({'error': 'E-Mail bereits registriert.'}), 409

    session['user_id'] = user['id']
    session['user_name'] = user['name']
    return jsonify({'message': 'Registrierung erfolgreich.', 'user': {'name': user['name'], 'email': user['email']}})


@app.route('/api/login', methods=['POST'])
def login():
    payload = request.get_json(force=True)
    email = payload.get('email', '').strip().lower()
    password = payload.get('password', '')

    with get_db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Login fehlgeschlagen.'}), 401

    session['user_id'] = user['id']
    session['user_name'] = user['name']
    return jsonify({'message': 'Login erfolgreich.', 'user': {'name': user['name'], 'email': user['email']}})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout erfolgreich.'})


@app.route('/api/session')
def session_status():
    if 'user_id' not in session:
        return jsonify({'authenticated': False})
    return jsonify({'authenticated': True, 'user': {'name': session['user_name']}})


@app.route('/api/routes', methods=['GET', 'POST'])
def routes_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Bitte zuerst einloggen.'}), 401

    user_id = session['user_id']

    if request.method == 'POST':
        payload = request.get_json(force=True)
        route_name = payload.get('route_name', '').strip() or 'Meine Route'
        points_json = payload.get('points_json', '').strip()
        if not points_json:
            return jsonify({'error': 'Keine Route vorhanden.'}), 400

        with get_db() as conn:
            conn.execute(
                'INSERT INTO routes (user_id, route_name, points_json) VALUES (?, ?, ?)',
                (user_id, route_name, points_json),
            )
        return jsonify({'message': 'Route gespeichert.'})

    with get_db() as conn:
        rows = conn.execute(
            'SELECT id, route_name, points_json, created_at FROM routes WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,),
        ).fetchall()
    return jsonify({'routes': [dict(r) for r in rows]})


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
