"""Headless smoke test: boots the game and plays several hundred frames.

Run with:  python tests/smoke_test.py
Uses pygame's dummy video driver so no display is required.
"""

import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pygame  # noqa: E402

from main import Game, PLAYING  # noqa: E402


def main():
    game = Game()

    # 60 frames on the menu screen.
    game.run(max_frames=60)
    pygame.init()  # re-init for the next phase (run() called pygame.quit())

    game2 = Game()
    game2.state = PLAYING  # jump straight into gameplay
    for _ in range(600):  # ~10 seconds of simulated play
        game2.update_playing()
        # steer the player toward the least crowded lane to survive longer
        from game.sprites import lane_center
        from game.settings import NUM_LANES, ROAD_LEFT, ROAD_RIGHT

        danger = {}
        for e in game2.enemies:
            if e.rect.bottom < game2.player.rect.top:
                danger[e.rect.centerx] = danger.get(e.rect.centerx, 0) + 1
        best_lane = min(range(NUM_LANES),
                        key=lambda l: danger.get(lane_center(l), 0))
        target = lane_center(best_lane)
        if game2.player.rect.centerx < target - 5:
            game2.player.rect.x += 6
        elif game2.player.rect.centerx > target + 5:
            game2.player.rect.x -= 6
        game2.player.rect.clamp_ip(
            pygame.Rect(ROAD_LEFT + 8, 0, ROAD_RIGHT - ROAD_LEFT - 16, 720))

    print(f"OK: 10s simulated | score={int(game2.score)} "
          f"| enemies_on_screen={len(game2.enemies)} "
          f"| speed={game2.scroll_speed:.2f} | state={game2.state}")
    assert int(game2.score) > 0, "score should grow during play"
    assert game2.scroll_speed > 5.0, "speed should ramp up over time"
    print("SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
