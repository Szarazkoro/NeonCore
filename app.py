from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
import random
import re
import secrets

app = Flask(__name__)
app.config["SECRET_KEY"] = "super-secret-cyber-key"

basedir = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "arena.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "Please log in to access the base."

def get_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]

@app.before_request
def protect_state_changing_requests():
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None

    submitted_token = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
    if not submitted_token or not secrets.compare_digest(submitted_token, get_csrf_token()):
        return jsonify({"success": False, "error": "Invalid CSRF token."}), 400

    return None

@app.context_processor
def inject_csrf_token():
    return {"csrf_token": get_csrf_token}

GAMES = {
    "gravity-switch": {"title": "Gravity Switch", "description": "Develop Dodge! Avoid red obstacles and keep the rhythm alive.", "js_file": "js/gravity-switch.js", "color": "#ff9f43"},
    "neon-core": {"title": "Neon Core", "description": "Develop Shield! Protect the core from incoming projectiles.", "js_file": "js/neon-core.js", "color": "#d2a8ff"},
    "target-practice": {"title": "Target Practice", "description": "Develop Base Damage! Hit targets before they disappear.", "js_file": "js/target-practice.js", "color": "#ff4757"},
    "core-sync": {"title": "Core Sync", "description": "Develop Critical Chance! Hit the pulse at the perfect moment.", "js_file": "js/core-sync.js", "color": "#f1c40f"},
    "energy-overload": {"title": "Energy Overload", "description": "Develop Ultimate Power! Catch blue energy and avoid red danger.", "js_file": "js/energy-overload.js", "color": "#00e5ff"},
    "laser-matrix": {"title": "Laser Matrix", "description": "Damage (70%) + Dodge (30%)! Track targets and avoid lasers.", "js_file": "js/laser-matrix.js", "color": "#ff4757"},
    "neon-highway": {"title": "Neon Highway", "description": "Dodge (70%) + Shield (30%). Collect green and avoid red.", "js_file": "js/neon-highway.js", "color": "#ff9f43"},
    "data-decryptor": {"title": "Data Decryptor", "description": "Critical Chance (60%) + Ultimate (40%). Enter the pattern flawlessly.", "js_file": "js/data-decryptor.js", "color": "#f1c40f"},
    "flux-stabilizer": {"title": "Flux Stabilizer", "description": "Critical Chance (60%) + Shield (40%). Keep the zone centered.", "js_file": "js/flux-stabilizer.js", "color": "#00e5ff"},
}

MAX_XP_PER_REQUEST = 250

class Player(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    arena_level = db.Column(db.Integer, default=1)
    cyber_credits = db.Column(db.Integer, default=0)
    bonus_hp = db.Column(db.Integer, default=0)

    xp_aim = db.Column(db.Float, default=0.0)
    xp_timing = db.Column(db.Float, default=0.0)
    xp_defense = db.Column(db.Float, default=0.0)
    xp_agility = db.Column(db.Float, default=0.0)
    xp_super = db.Column(db.Float, default=0.0)

    @property
    def max_health(self):
        return round(100.0 + ((self.arena_level - 1) * 20) + self.bonus_hp, 1)

    @property
    def base_damage(self):
        return round(10.0 + (self.xp_aim / 50), 1)

    @property
    def crit_chance(self):
        return round(min(5.0 + (self.xp_timing / 200), 50.0), 1)

    @property
    def max_shield(self):
        return round(50.0 + (self.xp_defense / 4), 1)

    @property
    def dodge_chance_tenths(self):
        return min(350, round(20 + (self.xp_agility * 2 / 15)))

    @property
    def dodge_chance(self):
        return self.dodge_chance_tenths / 10

    @property
    def ultimate_power(self):
        return round((self.base_damage * 3) + (self.xp_super / 50), 1)

    def to_dict(self):
        return {
            "username": self.username,
            "arena_level": self.arena_level,
            "cyber_credits": self.cyber_credits,
            "stats": {
                "health": self.max_health,
                "damage": self.base_damage,
                "crit_chance": self.crit_chance,
                "shield": self.max_shield,
                "dodge_chance": self.dodge_chance,
                "ultimate": self.ultimate_power,
            },
        }

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Player, int(user_id))

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not username:
            flash("Choose a valid callsign.", "error")
            return redirect(url_for("register"))

        if Player.query.filter_by(username=username).first():
            flash("This callsign is already in use.", "error")
            return redirect(url_for("register"))

        if len(password) < 8:
            flash("Password must be at least 8 characters long.", "error")
            return redirect(url_for("register"))
        if not re.search(r"[A-Z]", password):
            flash("Password must include at least one uppercase letter.", "error")
            return redirect(url_for("register"))
        if not re.search(r"[a-z]", password):
            flash("Password must include at least one lowercase letter.", "error")
            return redirect(url_for("register"))
        if not re.search(r"[0-9]", password):
            flash("Password must include at least one number.", "error")
            return redirect(url_for("register"))

        new_player = Player(username=username, password_hash=generate_password_hash(password))
        db.session.add(new_player)
        db.session.commit()

        login_user(new_player)
        return redirect(url_for("index"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        player = Player.query.filter_by(username=username).first()

        if player and check_password_hash(player.password_hash, password):
            login_user(player)
            return redirect(url_for("index"))

        flash("Invalid callsign or password.", "error")

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

@app.route("/")
@login_required
def index():
    return render_template("index.html", player=current_user, games=GAMES)

@app.route("/arena")
@login_required
def arena():
    return render_template("arena.html", player=current_user)

@app.route("/shop")
@login_required
def shop():
    return render_template("shop.html", player=current_user)

@app.route("/leaderboard")
@login_required
def leaderboard():
    top_players = Player.query.order_by(
        Player.arena_level.desc(),
        (Player.xp_aim + Player.xp_timing + Player.xp_defense + Player.xp_agility + Player.xp_super).desc(),
    ).limit(10).all()
    return render_template("leaderboard.html", players=top_players)

@app.route("/play/<slug>")
@login_required
def play_game(slug):
    if slug not in GAMES:
        return "The requested training module was not found.", 404

    other_games = {key: value for key, value in GAMES.items() if key != slug}
    recommended_keys = random.sample(list(other_games.keys()), min(3, len(other_games)))
    recommended_games = {key: other_games[key] for key in recommended_keys}
    return render_template("game.html", game=GAMES[slug], slug=slug, recommended=recommended_games)

@app.route("/api/save_xp", methods=["POST"])
@login_required
def save_xp():
    data = request.get_json(silent=True) or {}
    player = current_user

    xp_distribution = data.get("xp_distribution")
    try:
        if xp_distribution:
            xp_values = {
                key: min(MAX_XP_PER_REQUEST, max(0.0, float(xp_distribution.get(key, 0) or 0)))
                for key in ("aim", "timing", "defense", "agility", "super")
            }

            player.xp_aim += xp_values["aim"]
            player.xp_timing += xp_values["timing"]
            player.xp_defense += xp_values["defense"]
            player.xp_agility += xp_values["agility"]
            player.xp_super += xp_values["super"]
        else:
            game_type = data.get("game_type")
            earned_xp = min(MAX_XP_PER_REQUEST, max(0.0, float(data.get("earned_xp", 0) or 0)))
            if game_type == "aim":
                player.xp_aim += earned_xp
            elif game_type == "timing":
                player.xp_timing += earned_xp
            elif game_type == "defense":
                player.xp_defense += earned_xp
            elif game_type == "agility":
                player.xp_agility += earned_xp
            elif game_type == "super":
                player.xp_super += earned_xp
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Invalid XP payload."}), 400

    db.session.commit()
    return jsonify({"success": True, "new_stats": player.to_dict()})

@app.route("/api/win_arena", methods=["POST"])
@login_required
def win_arena():
    player = current_user
    player.arena_level += 1
    reward = 50 + (player.arena_level * 10)
    player.cyber_credits += reward
    db.session.commit()
    return jsonify({"success": True, "new_level": player.arena_level, "credits": player.cyber_credits})

@app.route("/api/buy_hp", methods=["POST"])
@login_required
def buy_hp():
    player = current_user
    cost = 100 + ((player.bonus_hp // 25) * 50)

    if player.cyber_credits >= cost:
        player.cyber_credits -= cost
        player.bonus_hp += 25
        db.session.commit()
        return jsonify({"success": True, "new_hp": player.max_health, "credits": player.cyber_credits})

    return jsonify({"success": False, "error": "Not enough cyber credits."}), 400

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)