"""Sprites and drawing helpers: player car, enemy traffic, and the road."""

import random

import pygame

from .settings import (
    CAR_HEIGHT,
    CAR_WIDTH,
    COLLISION_INSET,
    ENEMY_COLORS,
    ENEMY_SCREEN_SPEED_FACTOR,
    ENEMY_SPEED_JITTER,
    GRASS_GREEN,
    GRASS_GREEN_DARK,
    LANE_WHITE,
    LANE_WIDTH,
    NUM_LANES,
    PLAYER_COLOR,
    PLAYER_X_SPEED,
    ROAD_EDGE,
    ROAD_GRAY,
    ROAD_LEFT,
    ROAD_RIGHT,
    WINDOW_HEIGHT,
    WINDOW_WIDTH,
)


def lane_center(lane_index):
    """X coordinate of the center of a lane (0-based, left to right)."""
    return ROAD_LEFT + LANE_WIDTH * lane_index + LANE_WIDTH // 2


def draw_car(surface, rect, color):
    """Draw a top-down car inside `rect` using plain shapes (no assets)."""
    body = pygame.Rect(rect)

    # Wheels poking out at the four corners.
    wheel_w, wheel_h = 8, 20
    for wx, wy in (
        (body.left - 3, body.top + 10),
        (body.right - 5, body.top + 10),
        (body.left - 3, body.bottom - 30),
        (body.right - 5, body.bottom - 30),
    ):
        pygame.draw.rect(surface, (15, 15, 15), (wx, wy, wheel_w, wheel_h),
                         border_radius=3)

    # Main body.
    pygame.draw.rect(surface, color, body, border_radius=10)
    pygame.draw.rect(surface, (0, 0, 0), body, width=2, border_radius=10)

    # Windshield (front third) and rear window.
    glass = (30, 40, 55)
    ws = body.inflate(-14, -int(body.height * 0.55))
    ws.top = body.top + 14
    pygame.draw.rect(surface, glass, ws, border_radius=6)
    rw = body.inflate(-18, -int(body.height * 0.72))
    rw.bottom = body.bottom - 10
    pygame.draw.rect(surface, glass, rw, border_radius=5)

    # Roof highlight.
    roof = body.inflate(-22, -int(body.height * 0.34))
    roof.centery = body.centery + 4
    roof_color = tuple(min(255, c + 45) for c in color)
    pygame.draw.rect(surface, roof_color, roof, border_radius=6)

    # Headlights.
    pygame.draw.circle(surface, (255, 240, 170), (body.left + 8, body.top + 5), 3)
    pygame.draw.circle(surface, (255, 240, 170), (body.right - 8, body.top + 5), 3)


class Player:
    """The player's car; steers left/right, can boost and brake."""

    def __init__(self):
        self.rect = pygame.Rect(0, 0, CAR_WIDTH, CAR_HEIGHT)
        self.rect.midbottom = (WINDOW_WIDTH // 2, WINDOW_HEIGHT - 30)

    def update(self, keys, x_min, x_max):
        dx = 0
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            dx -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            dx += 1
        self.rect.x += dx * PLAYER_X_SPEED
        self.rect.clamp_ip(pygame.Rect(x_min, 0, x_max - x_min, WINDOW_HEIGHT))

    @property
    def hitbox(self):
        """Slightly forgiving hitbox for fairer collisions."""
        return self.rect.inflate(-2 * COLLISION_INSET, -2 * COLLISION_INSET)

    def draw(self, surface):
        draw_car(surface, self.rect, PLAYER_COLOR)


class EnemyCar:
    """A traffic car driving slower than the player, coming toward them."""

    def __init__(self, lane, scroll_speed):
        self.rect = pygame.Rect(0, 0, CAR_WIDTH, CAR_HEIGHT)
        self.rect.centerx = lane_center(lane)
        self.rect.bottom = 0  # starts just above the visible road
        factor = ENEMY_SCREEN_SPEED_FACTOR + random.uniform(
            -ENEMY_SPEED_JITTER, ENEMY_SPEED_JITTER)
        self.speed = max(2.0, scroll_speed * factor)
        self.color = random.choice(ENEMY_COLORS)
        self.scored = False

    def update(self):
        self.rect.y += self.speed

    @property
    def offscreen(self):
        return self.rect.top > WINDOW_HEIGHT

    @property
    def hitbox(self):
        return self.rect.inflate(-2 * COLLISION_INSET, -2 * COLLISION_INSET)

    def draw(self, surface):
        draw_car(surface, self.rect, self.color)


class Road:
    """Scrolling road background: grass stripes, asphalt, and lane markers."""

    STRIPE_HEIGHT = 48

    def __init__(self):
        self.dash_offset = 0.0
        self.grass_offset = 0.0

    def update(self, scroll_speed):
        self.dash_offset = (self.dash_offset + scroll_speed) % 64
        self.grass_offset = (self.grass_offset + scroll_speed) % (self.STRIPE_HEIGHT * 2)

    def draw(self, surface):
        surface.fill(GRASS_GREEN)

        # Alternating grass stripes for a sense of speed.
        y = -self.STRIPE_HEIGHT * 2 + int(self.grass_offset)
        dark = True
        while y < WINDOW_HEIGHT:
            if dark:
                pygame.draw.rect(surface, GRASS_GREEN_DARK,
                                 (0, y, ROAD_LEFT, self.STRIPE_HEIGHT))
                pygame.draw.rect(surface, GRASS_GREEN_DARK,
                                 (ROAD_RIGHT, y, WINDOW_WIDTH - ROAD_RIGHT, self.STRIPE_HEIGHT))
            y += self.STRIPE_HEIGHT
            dark = not dark

        # Asphalt.
        pygame.draw.rect(surface, ROAD_GRAY,
                         (ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, WINDOW_HEIGHT))

        # Solid edge lines.
        pygame.draw.rect(surface, ROAD_EDGE, (ROAD_LEFT + 4, 0, 6, WINDOW_HEIGHT))
        pygame.draw.rect(surface, ROAD_EDGE, (ROAD_RIGHT - 10, 0, 6, WINDOW_HEIGHT))

        # Dashed lane dividers.
        for lane in range(1, NUM_LANES):
            x = ROAD_LEFT + lane * LANE_WIDTH - 3
            y = -64 + int(self.dash_offset)
            while y < WINDOW_HEIGHT:
                pygame.draw.rect(surface, LANE_WHITE, (x, y, 6, 34))
                y += 64
