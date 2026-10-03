"""Car Racer - Highway Dash.

A top-down highway racer built with pygame. Steer through traffic,
survive as long as you can, and chase the high score.

Run:
    python main.py
"""

import json
import os
import random
import sys

import pygame

from game.settings import (
    BASE_SCROLL_SPEED,
    BOOST_BONUS,
    BRAKE_FACTOR,
    CAR_HEIGHT,
    FPS,
    HIGHSCORE_FILE,
    HUD_ACCENT,
    HUD_BG,
    HUD_TEXT,
    MAX_SCROLL_SPEED,
    NUM_LANES,
    OVERLAY_BG,
    ROAD_LEFT,
    ROAD_RIGHT,
    SPAWN_INTERVAL_MIN,
    SPAWN_INTERVAL_START,
    SPEED_INCREMENT,
    TITLE,
    WINDOW_HEIGHT,
    WINDOW_WIDTH,
)
from game.sprites import EnemyCar, Player, Road, lane_center

MENU, PLAYING, GAME_OVER = "menu", "playing", "game_over"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_highscore():
    try:
        with open(os.path.join(BASE_DIR, HIGHSCORE_FILE), encoding="utf-8") as f:
            return int(json.load(f).get("highscore", 0))
    except (OSError, ValueError, json.JSONDecodeError):
        return 0


def save_highscore(value):
    try:
        with open(os.path.join(BASE_DIR, HIGHSCORE_FILE), "w", encoding="utf-8") as f:
            json.dump({"highscore": int(value)}, f)
    except OSError:
        pass  # non-critical; just skip persistence


class Game:
    """Owns all game state and the main loop."""

    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption(TITLE)
        self.clock = pygame.time.Clock()

        self.font_small = pygame.font.Font(None, 28)
        self.font_big = pygame.font.Font(None, 64)
        self.font_huge = pygame.font.Font(None, 84)

        self.highscore = load_highscore()
        self.state = MENU
        self.reset_run()

    # ------------------------------------------------------------------ runs
    def reset_run(self):
        """Prepare a fresh run (also used to start the first game)."""
        self.player = Player()
        self.enemies = []
        self.road = Road()
        self.scroll_speed = BASE_SCROLL_SPEED
        self.score = 0.0
        self.spawn_timer = 0
        self.new_record = False

    # ----------------------------------------------------------------- logic
    def spawn_enemy(self):
        """Spawn traffic in a random lane that is currently clear up top."""
        blocked = {e.rect.centerx for e in self.enemies
                   if e.rect.bottom < CAR_HEIGHT * 2.5}
        open_lanes = [lane for lane in range(NUM_LANES)
                      if lane_center(lane) not in blocked]
        # Never wall off every lane in the spawn zone.
        if len(open_lanes) <= 1:
            return
        self.enemies.append(EnemyCar(random.choice(open_lanes), self.scroll_speed))

    def update_playing(self):
        keys = pygame.key.get_pressed()

        # Speed: ramps up over time; boost with UP/W, brake with DOWN/S.
        self.scroll_speed = min(self.scroll_speed + SPEED_INCREMENT, MAX_SCROLL_SPEED)
        speed = self.scroll_speed
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            speed = min(speed + BOOST_BONUS, MAX_SCROLL_SPEED + BOOST_BONUS)
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            speed *= BRAKE_FACTOR

        self.road.update(speed)
        self.player.update(keys, ROAD_LEFT + 8, ROAD_RIGHT - 8)
        self.score += speed * 0.05

        # Enemy spawning: interval shrinks as the game speeds up.
        self.spawn_timer -= 1
        if self.spawn_timer <= 0:
            self.spawn_enemy()
            progress = (self.scroll_speed - BASE_SCROLL_SPEED) / (
                MAX_SCROLL_SPEED - BASE_SCROLL_SPEED)
            interval = SPAWN_INTERVAL_START - progress * (
                SPAWN_INTERVAL_START - SPAWN_INTERVAL_MIN)
            self.spawn_timer = int(interval) + random.randint(-6, 6)

        # Move enemies, score overtakes, cull off-screen cars.
        for enemy in self.enemies:
            enemy.update()
            if not enemy.scored and enemy.rect.top > self.player.rect.bottom:
                enemy.scored = True
                self.score += 25  # bonus for each car passed
        self.enemies = [e for e in self.enemies if not e.offscreen]

        # Crash check.
        if any(self.player.hitbox.colliderect(e.hitbox) for e in self.enemies):
            self.state = GAME_OVER
            final = int(self.score)
            if final > self.highscore:
                self.highscore = final
                self.new_record = True
                save_highscore(final)

    # ------------------------------------------------------------- rendering
    def draw_hud(self):
        bar = pygame.Surface((WINDOW_WIDTH, 40))
        bar.fill(HUD_BG)
        self.screen.blit(bar, (0, 0))

        score = self.font_small.render(f"SCORE  {int(self.score)}", True, HUD_TEXT)
        best = self.font_small.render(f"BEST  {self.highscore}", True, HUD_ACCENT)
        kmh = self.font_small.render(
            f"{int(self.scroll_speed * 18)} km/h", True, HUD_TEXT)
        self.screen.blit(score, (12, 10))
        self.screen.blit(kmh, (WINDOW_WIDTH // 2 - kmh.get_width() // 2, 10))
        self.screen.blit(best, (WINDOW_WIDTH - best.get_width() - 12, 10))

    def draw_overlay(self, lines):
        """Draw centered text lines over a dark backdrop. lines: (text, font, color)."""
        veil = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.SRCALPHA)
        veil.fill(OVERLAY_BG)
        self.screen.blit(veil, (0, 0))

        total = sum(f.get_height() + 16 for _, f, _ in lines)
        y = (WINDOW_HEIGHT - total) // 2
        for text, font, color in lines:
            surf = font.render(text, True, color)
            self.screen.blit(surf, (WINDOW_WIDTH // 2 - surf.get_width() // 2, y))
            y += surf.get_height() + 16

    def draw(self):
        self.road.draw(self.screen)
        for enemy in self.enemies:
            enemy.draw(self.screen)
        self.player.draw(self.screen)
        self.draw_hud()

        if self.state == MENU:
            self.draw_overlay([
                ("CAR RACER", self.font_huge, HUD_ACCENT),
                ("Highway Dash", self.font_big, HUD_TEXT),
                ("Steer with Arrow keys or WASD", self.font_small, HUD_TEXT),
                ("UP = boost   DOWN = brake", self.font_small, HUD_TEXT),
                ("Press SPACE to start", self.font_small, HUD_ACCENT),
                ("ESC to quit", self.font_small, HUD_TEXT),
            ])
        elif self.state == GAME_OVER:
            lines = [
                ("CRASHED!", self.font_huge, (255, 80, 80)),
                (f"Score  {int(self.score)}", self.font_big, HUD_TEXT),
                (f"Best   {self.highscore}", self.font_big, HUD_ACCENT),
            ]
            if self.new_record:
                lines.append(("NEW RECORD!", self.font_small, HUD_ACCENT))
            lines.append(("Press SPACE to restart", self.font_small, HUD_TEXT))
            lines.append(("ESC to quit", self.font_small, HUD_TEXT))
            self.draw_overlay(lines)

        pygame.display.flip()

    # ------------------------------------------------------------------ loop
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    return False
                if event.key == pygame.K_SPACE and self.state in (MENU, GAME_OVER):
                    self.reset_run()
                    self.state = PLAYING
        return True

    def run(self, max_frames=None):
        """Main loop. `max_frames` exists for automated headless smoke tests."""
        frames = 0
        running = True
        while running:
            running = self.handle_events()

            if self.state == PLAYING:
                self.update_playing()
            else:
                # Keep the scenery moving gently behind menus.
                self.road.update(2.0)

            self.draw()
            self.clock.tick(FPS)

            frames += 1
            if max_frames is not None and frames >= max_frames:
                running = False

        pygame.quit()


def main():
    Game().run()
    sys.exit(0)


if __name__ == "__main__":
    main()
