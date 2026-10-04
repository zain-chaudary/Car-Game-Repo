"""Central configuration for the car racing game."""

# --- Window / loop -----------------------------------------------------------
WINDOW_WIDTH = 480
WINDOW_HEIGHT = 720
FPS = 60
TITLE = "Car Racer - Highway Dash"

# --- Road layout -------------------------------------------------------------
ROAD_MARGIN = 60                       # grass strip width on each side
ROAD_LEFT = ROAD_MARGIN
ROAD_RIGHT = WINDOW_WIDTH - ROAD_MARGIN
ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT
NUM_LANES = 4
LANE_WIDTH = ROAD_WIDTH // NUM_LANES

# --- Car dimensions ----------------------------------------------------------
CAR_WIDTH = 46
CAR_HEIGHT = 84

# --- Physics / difficulty ----------------------------------------------------
BASE_SCROLL_SPEED = 5.0                # starting road scroll speed (px/frame)
MAX_SCROLL_SPEED = 13.0                # top speed cap
SPEED_INCREMENT = 0.0016               # passive acceleration per frame
BOOST_BONUS = 2.5                      # extra speed while holding UP/W
BRAKE_FACTOR = 0.55                    # speed multiplier while holding DOWN/S
PLAYER_X_SPEED = 6.5                   # horizontal steering speed (px/frame)
ENEMY_SCREEN_SPEED_FACTOR = 0.55       # enemy speed down the screen vs. scroll
ENEMY_SPEED_JITTER = 0.10              # random +/- variation per enemy
COLLISION_INSET = 7                    # px forgiveness on hitboxes

# Spacing (in frames at 60 FPS) between enemy spawns, shrinks as speed rises.
SPAWN_INTERVAL_START = 75
SPAWN_INTERVAL_MIN = 32

# --- Colors ------------------------------------------------------------------
GRASS_GREEN = (34, 102, 44)
GRASS_GREEN_DARK = (28, 88, 38)
ROAD_GRAY = (58, 58, 64)
ROAD_EDGE = (230, 230, 230)
LANE_WHITE = (240, 240, 240)
HUD_BG = (18, 18, 24)
HUD_TEXT = (255, 255, 255)
HUD_ACCENT = (255, 200, 60)
OVERLAY_BG = (0, 0, 0, 170)

PLAYER_COLOR = (220, 40, 40)
ENEMY_COLORS = [
    (52, 120, 246),    # blue
    (250, 176, 26),    # orange
    (140, 90, 220),    # purple
    (46, 184, 120),    # green
    (235, 235, 240),   # white
    (250, 110, 160),   # pink
]

HIGHSCORE_FILE = "highscore.json"
