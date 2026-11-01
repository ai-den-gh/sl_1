# JUJUTSU KAISEN: CURSED CLASH
## Game Design Document (GDD)

### 1. Game Overview

Create a 2D real-time fighting game inspired by *Jujutsu Kaisen*, featuring simple stickman characters with recognizable hairstyles, clothing, weapons, and signature effects from the anime.

The game should feel like a fast-paced stickman fighting game, similar to popular browser-based stickman combat games. It must NOT be turn-based. Every attack, movement, dodge, and ability should happen in real time.

**Core features:**
- Two-player local multiplayer.
- Single-player story mode against AI-controlled opponents.
- Five playable characters: Gojo, Sukuna, Yuji, Yuta, and Megumi.
- Unique abilities and special techniques for every character.
- Fast-paced combat with combos, blocking, dodging, and ultimate attacks.
- A simple but polished 2D stickman art style.

### 2. Visual Style

Characters should be drawn as stickmen rather than detailed anime models.

Each character should have:
- A circular head.
- Simple stick-like arms and legs.
- A recognizable hairstyle or head accessory.
- Clothing represented through colored shapes around the torso.
- Unique animations for attacks, movement, and abilities.

Use visual effects to make attacks exciting:
- Blue and red energy particles.
- Screen shake on powerful hits.
- Flash effects when attacks connect.
- Glowing energy projectiles.
- Explosions and impact effects.
- Brief slow motion during ultimate attacks.

The background should feature a simple 2D arena with platforms or a flat fighting surface. Include multiple maps with different Jujutsu Kaisen-inspired environments.

### 3. Combat Mechanics

Combat must be entirely real-time.

Each character has:
- Health: 1000 HP.
- Cursed Energy: 100 points.
- Basic attack.
- Heavy attack.
- Block.
- Dash/dodge.
- Four unique special techniques.

**Controls (Player 1):**
- A/D: Move left/right.
- W: Jump.
- S: Block.
- J: Basic attack.
- K: Heavy attack.
- U/I/O/L: Four special abilities.
- Shift: Dash.

**Controls (Player 2):**
- Arrow keys: Move.
- Down Arrow: Block.
- Numpad 1: Basic attack.
- Numpad 2: Heavy attack.
- Numpad 4/5/6/7: Special abilities.
- Numpad 0: Dash.

Implement hitboxes and hurtboxes so attacks only connect when characters are within their actual attack range.

Add combo mechanics: consecutive attacks should chain together if timed correctly. Characters should have knockback, hitstun, and brief invulnerability frames after certain attacks.

Cursed Energy regenerates slowly over time. Special techniques consume different amounts of energy.

### 4. Playable Characters and Abilities

#### GOJO SATORU
Fighting style: Long-range attacks, teleportation, and overwhelming cursed techniques.

1. **Lapse Blue:** Creates an attractive blue energy orb that pulls the opponent toward its center.
2. **Reversal Red:** Fires a powerful red projectile that knocks opponents backward.
3. **Hollow Purple:** Combines Blue and Red into a devastating traveling projectile that deals massive damage.
4. **Infinite Void (Ultimate):** Opens Gojo's Domain Expansion. The opponent becomes temporarily immobilized while Gojo unleashes a powerful finishing attack.

Passive: Infinity. Automatically blocks or reduces some incoming attacks, but consumes cursed energy while active.

#### SUKUNA
Fighting style: Aggressive close-range combat with devastating slashing attacks.

1. **Dismantle:** Sends a fast invisible-style slash projectile toward the opponent.
2. **Cleave:** A powerful close-range slash that deals damage based on the opponent's remaining health.
3. **Flame Arrow:** Fires a massive explosive fire projectile.
4. **Malevolent Shrine (Ultimate):** Opens Sukuna's Domain Expansion, unleashing continuous slashes across a large portion of the arena.

Passive: Increased damage when Sukuna's health is low.

#### YUJI ITADORI
Fighting style: Fast melee combat, punches, kicks, and powerful combinations.

1. **Divergent Fist:** A punch followed by a delayed cursed energy impact.
2. **Black Flash:** A perfectly timed powerful punch with a screen flash and explosive impact.
3. **Manji Kick:** A fast spinning kick that launches the opponent.
4. **Black Flash Barrage (Ultimate):** A rapid sequence of punches and kicks ending in a devastating Black Flash.

Passive: Increased melee damage and slightly faster movement speed.

#### YUTA OKKOTSU
Fighting style: Balanced sword combat with powerful cursed techniques.

1. **Katana Slash:** A quick forward sword strike.
2. **Rika Grab:** Summons Rika to grab and slam the opponent.
3. **Cursed Speech:** Commands the opponent to stop, briefly stunning them.
4. **Rika Manifestation (Ultimate):** Fully manifests Rika, allowing Yuta to unleash a powerful series of attacks.

Passive: Has slightly faster cursed energy regeneration.

#### MEGUMI FUSHIGURO
Fighting style: Summoning shikigami and controlling the battlefield.

1. **Divine Dogs:** Summons two dogs that charge at and attack the opponent.
2. **Nue:** Summons a flying shikigami that attacks with electricity.
3. **Toad:** Summons a toad that grabs and briefly immobilizes the opponent.
4. **Chimera Shadow Garden (Ultimate):** Covers the arena in shadows, allowing Megumi to summon multiple shikigami and attack from different directions.

Passive: Summons last slightly longer than normal.

### 5. Game Modes

**Mode A: Two-Player Versus**

Two players fight locally on the same keyboard. Both players select their characters before entering an arena.

Include:
- Character selection screen.
- Arena selection.
- Health bars.
- Cursed energy bars.
- Round timer.
- First to two rounds wins.
- Victory and defeat screens.

**Mode B: Story Mode**

Create a single-player progression mode where the player fights AI opponents.

The story should contain five character-themed chapters:

1. Yuji's Awakening: Fight through several cursed spirits and eventually face Sukuna.
2. The Strongest Sorcerer: Play as Gojo and defeat increasingly difficult opponents.
3. King of Curses: Play as Sukuna and fight powerful sorcerers.
4. The Special Grade: Play as Yuta and fight increasingly difficult enemies.
5. Ten Shadows: Play as Megumi and battle increasingly powerful cursed spirits.

Each chapter should contain approximately 3–5 fights, with a boss fight at the end.

AI opponents should:
- Approach the player.
- Attack when within range.
- Block incoming attacks occasionally.
- Dodge powerful abilities.
- Use their special techniques.
- Increase in difficulty as the player progresses.

### 6. User Interface

Create a polished main menu with:
- Play Story Mode.
- Two Player Versus.
- Character Gallery.
- Settings.

During battles, display:
- Player names and character portraits.
- Health bars.
- Cursed energy bars.
- Special ability cooldown indicators.
- Round timer.
- Current combo counter.

Character selection should show each character's name, fighting style, passive ability, and four special techniques.

### 7. Technical Requirements

Build this as a browser-based game using HTML, CSS, and JavaScript. Use HTML5 Canvas for rendering and JavaScript for game logic.

Requirements:
- Smooth 60 FPS gameplay.
- Responsive canvas that scales to different screen sizes.
- Real-time keyboard input handling.
- Separate character classes or objects for each fighter.
- Reusable combat, hitbox, projectile, and animation systems.
- Simple AI behavior for story mode.
- No turn-based mechanics.
- No external game engine required.

Organize the project into separate files where appropriate:
- index.html
- style.css
- game.js
- characters.js
- combat.js
- ai.js
- ui.js

### 8. Development Priorities

Build the game in stages:

1. Create the canvas, arena, and two basic stickman fighters.
2. Implement movement, jumping, blocking, and basic attacks.
3. Add health, cursed energy, damage, and hit detection.
4. Implement all five characters and their unique abilities.
5. Add special effects, animations, and ultimate attacks.
6. Create the two-player versus mode.
7. Create AI opponents and story mode.
8. Add menus, character selection, sound effects, and polish.

**Important:** Prioritize making the combat actually playable before adding menus or decorative features. Do not create a static mockup. The final result must be a functional, playable real-time fighting game. If the full game is too large to implement at once, complete the first playable combat prototype and build the remaining features incrementally.