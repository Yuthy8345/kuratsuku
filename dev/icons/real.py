import math, random
random.seed(7)
W = 1024
def t(x): return (x - 512) / 512
def roof(x): return 178 - 74 * t(x) ** 2
def tier1(x): return 334 + 22 * t(x) ** 2
def tier2(x): return 470 + 36 * t(x) ** 2
def arc(fn, x0=-60, x1=1084, step=16, off=0):
    return ' '.join(f'{x:.0f},{fn(x)+off:.1f}' for x in range(x0, x1 + 1, step))
def band(f_top, f_bot, off_top=0, off_bot=0):
    top = arc(f_top, off=off_top); bot = ' '.join(reversed(arc(f_bot, off=off_bot).split(' ')))
    return f'<polygon points="{top} {bot}"/>'

# ---------- background (stadium) ----------
stands_upper = f'M-60 {roof(-60):.0f} ' + ' '.join(f'L{x} {roof(x):.1f}' for x in range(-60, 1085, 16)) + ' ' + ' '.join(f'L{x} {tier1(x):.1f}' for x in range(1084, -61, -16)) + ' Z'
stands_lower = f'M-60 {tier1(-60)+18:.0f} ' + ' '.join(f'L{x} {tier1(x)+18:.1f}' for x in range(-60, 1085, 16)) + ' ' + ' '.join(f'L{x} {tier2(x):.1f}' for x in range(1084, -61, -16)) + ' Z'
def stand_point():
    while True:
        x = random.uniform(-10, 1034); y = random.uniform(roof(x) + 10, tier2(x) - 6)
        if not (tier1(x) - 3 < y < tier1(x) + 21): return x, y
flashes = ''
for _ in range(420):
    x, y = stand_point(); r = random.choice([1.1, 1.4, 1.7, 2.1, 2.6])
    c = random.choice(['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFF3D6', '#DDEBFF'])
    flashes += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="{c}" opacity="{random.uniform(.55,1):.2f}"/>'
stars = ''
for _ in range(14):
    x, y = stand_point(); L = random.uniform(10, 18)
    stars += f'<g transform="translate({x:.0f} {y:.0f})"><circle r="3.4" fill="#FFFFFF"/><path d="M{-L:.0f} 0 H{L:.0f} M0 {-L*.7:.0f} V{L*.7:.0f}" stroke="#FFFFFF" stroke-width="1.6" opacity=".85"/></g>'
rows = ''
for k in range(1, 9):
    rows += '<polyline points="' + ' '.join(f'{x},{roof(x) + (tier1(x)-roof(x))*k/9:.1f}' for x in range(-60,1085,32)) + '"/>'
for k in range(1, 6):
    rows += '<polyline points="' + ' '.join(f'{x},{tier1(x)+18 + (tier2(x)-tier1(x)-18)*k/6:.1f}' for x in range(-60,1085,32)) + '"/>'
aisles = ''
for x in range(-40, 1100, 118):
    xb = 512 + (x-512)*1.18
    aisles += f'<line x1="{x}" y1="{roof(x)+4:.1f}" x2="{xb:.0f}" y2="{tier2(xb)-2:.1f}"/>'
# ---------- a full house: every seat taken ----------
aisle_lines = []
for x in range(-40, 1100, 118):
    xb = 512 + (x-512)*1.18
    aisle_lines.append((x, roof(x)+4, xb, tier2(xb)-2))
def near_aisle(px, py):
    for (x1, y1, x2, y2) in aisle_lines:
        if y1 <= py <= y2:
            ax = x1 + (x2 - x1) * (py - y1) / (y2 - y1)
            if abs(px - ax) < 5: return True
    return False
def pick(opts):
    r = random.random(); acc = 0
    for c, w in opts:
        acc += w
        if r <= acc: return c
    return opts[-1][0]
HOME = [('#1E56C8', .42), ('#F2F2F2', .2), ('#C8202A', .1), ('#15203A', .18), ('#6B7280', .1)]
AWAY = [('#F5D000', .55), ('#141414', .35), ('#F2F2F2', .1)]
SKIN = ['#C99A7C', '#B9876A', '#D8AE90', '#A8775C']
people = ''
def row_people(ybase, rh, away_from=None):
    global people
    x = -20 + random.uniform(0, 6)
    while x < 1046:
        yb = ybase(x); h = rh(x) * 0.98
        step = h * random.uniform(.5, .62)
        if not near_aisle(x, yb):
            away = away_from is not None and x > away_from
            col = pick(AWAY if away else HOME)
            yj = yb + random.uniform(-1.2, 1.2)
            tw, th = h * .3, h * .34
            people += f'<ellipse cx="{x:.1f}" cy="{yj - th:.1f}" rx="{tw:.1f}" ry="{th:.1f}" fill="{col}"/>'
            hr = h * .16; hy = yj - th * 2 - hr * .6
            people += f'<circle cx="{x:.1f}" cy="{hy:.1f}" r="{hr:.1f}" fill="{random.choice(SKIN)}"/>'
            people += f'<path d="M{x-hr:.1f} {hy:.1f} a{hr:.1f} {hr:.1f} 0 0 1 {2*hr:.1f} 0 Z" fill="#1A1410" opacity=".85"/>'
            r = random.random()
            if r < .2:   # arms up
                people += f'<path d="M{x-tw*.8:.1f} {yj-th*1.6:.1f} l{-h*.12:.1f} {-h*.5:.1f} M{x+tw*.8:.1f} {yj-th*1.6:.1f} l{h*.12:.1f} {-h*.5:.1f}" stroke="{col}" stroke-width="{h*.12:.1f}" stroke-linecap="round"/>'
            elif r < .3: # scarf held high
                sc = '#F5D000' if away else random.choice(['#1E56C8', '#F2F2F2', '#C8202A'])
                people += f'<rect x="{x-h*.5:.1f}" y="{hy-hr-h*.38:.1f}" width="{h:.1f}" height="{h*.14:.1f}" fill="{sc}"/>'
        x += step
# upper tier (further away: smaller), then lower tier (closer)
for k in range(9):
    row_people(lambda x, k=k: roof(x) + (tier1(x) - roof(x)) * (k + 1) / 9, lambda x: (tier1(x) - roof(x)) / 9 * 1.15)
people_u = people; people = ''
for k in range(6):
    row_people(lambda x, k=k: tier1(x) + 18 + (tier2(x) - tier1(x) - 18) * (k + 1) / 6, lambda x: (tier2(x) - tier1(x) - 18) / 6 * 1.12, away_from=760)
people_l = people
seat_lights = ''
def row_lights(ybase, rh, away_from=None):
    global seat_lights
    x = -16 + random.uniform(0, 5)
    while x < 1042:
        h = rh(x); yb = ybase(x) + random.uniform(-h * .25, h * .25)
        if random.random() < .92 and not near_aisle(x, yb):
            away = away_from is not None and x > away_from
            c = random.choices(['#FFFFFF', '#FFF1D0', '#DCE8FF', '#F5D000' if away else '#7FA8FF'], [.66, .16, .1, .08])[0]
            r = h * random.uniform(.07, .16)
            seat_lights += f'<circle cx="{x:.1f}" cy="{yb:.1f}" r="{r:.2f}" fill="{c}" opacity="{random.uniform(.45, 1):.2f}"/>'
        x += h * random.uniform(.32, .46)
for k in range(18):
    row_lights(lambda x, k=k: roof(x) + 6 + (tier1(x) - roof(x) - 8) * (k + .5) / 18, lambda x: (tier1(x) - roof(x)) / 18 * 1.9)
for k in range(12):
    row_lights(lambda x, k=k: tier1(x) + 20 + (tier2(x) - tier1(x) - 22) * (k + .5) / 12, lambda x: (tier2(x) - tier1(x) - 18) / 12 * 1.9, away_from=760)
stars = ''
for _ in range(46):
    x, y = stand_point(); L = random.uniform(9, 20)
    stars += f'<g transform="translate({x:.0f} {y:.0f})"><circle r="{random.uniform(2.6, 4):.1f}" fill="#FFFFFF"/><path d="M{-L:.0f} 0 H{L:.0f} M0 {-L*.7:.0f} V{L*.7:.0f}" stroke="#FFFFFF" stroke-width="1.5" opacity=".85"/></g>'
# roof floodlights
lights = ''
for i in range(0, 46):
    x = -40 + i * 24
    y = roof(x) + 6
    lights += f'<rect x="{x-8}" y="{y-4:.1f}" width="16" height="8" rx="3" fill="#FFF8E6"/>'
    lights += f'<rect x="{x-5}" y="{y+8:.1f}" width="10" height="5" rx="2" fill="#FFF8E6" opacity=".85"/>'
roofglow = '<polyline points="' + ' '.join(f'{x},{roof(x)+8:.1f}' for x in range(-60, 1085, 32)) + '" fill="none" stroke="#FFF2D2" stroke-width="26" stroke-linecap="round"/>'
shafts = ''
for xs in (120, 330, 512, 700, 900):
    yt = roof(xs) + 10
    shafts += f'<polygon points="{xs-14},{yt:.0f} {xs+14},{yt:.0f} {xs+150 + (xs-512)*.4:.0f},1024 {xs-150 + (xs-512)*.4:.0f},1024" fill="url(#shaft)"/>'
# LED boards along the pitch side
boards = ''
cols = ['#F2B33D', '#FFFFFF', '#3E7BFA', '#F2B33D', '#E8E8E8', '#C8202A']
for i in range(0, 22):
    xa, xb = -60 + i * 54, -60 + (i + 1) * 54 - 4
    c = cols[i % len(cols)]
    pts = f'{xa},{tier2(xa)+2:.1f} {xb},{tier2(xb)+2:.1f} {xb},{tier2(xb)+22:.1f} {xa},{tier2(xa)+22:.1f}'
    boards += f'<polygon points="{pts}" fill="{c}" opacity=".85"/>'
# pitch: stripes that widen toward the viewer
pitch_top = lambda x: tier2(x) + 30
ys = [0]
h = 14
while ys[-1] < 640:
    ys.append(ys[-1] + h); h *= 1.28
stripes = ''
for i in range(len(ys) - 1):
    y0, y1 = ys[i], ys[i + 1]
    top = ' '.join(f'{x},{pitch_top(x)+y0:.1f}' for x in range(-60, 1085, 32))
    bot = ' '.join(f'{x},{pitch_top(x)+y1:.1f}' for x in range(1084, -61, -32))
    stripes += f'<polygon points="{top} {bot}" fill="{"#2C7A4E" if i % 2 else "#276C45"}"/>'
far_line = ' '.join(f'{x},{pitch_top(x)+4:.1f}' for x in range(-60, 1085, 16))
# players (small, at depth): 'h' = blue shirt / white shorts / red socks, 'a' = yellow shirt / black shorts / yellow socks
players = ''
for (x, y, s, kit) in [(830, 528, .85, 'h'), (972, 540, .9, 'a'), (858, 562, 1.0, 'a'), (760, 584, 1.1, 'h'), (936, 606, 1.25, 'h'), (668, 612, 1.25, 'a'), (604, 652, 1.45, 'h'), (862, 680, 1.6, 'a'), (552, 726, 1.9, 'h'), (1000, 668, 1.4, 'a')]:
    body = '#1E56C8' if kit == 'h' else '#F5D000'
    shorts = '#F4F4F4' if kit == 'h' else '#141414'
    socks = '#D0202A' if kit == 'h' else '#F5D000'
    trim = '#F4F4F4' if kit == 'h' else '#141414'
    hgt = 26 * s
    players += f'''<g transform="translate({x} {y}) scale({s})">
<ellipse cx="0" cy="0" rx="10" ry="3" fill="#000" opacity=".35"/>
<rect x="-4" y="-12" width="3" height="5" fill="#8a5a44"/><rect x="1" y="-12" width="3" height="5" fill="#8a5a44"/>
<rect x="-4" y="-7" width="3" height="7" fill="{socks}"/><rect x="1" y="-7" width="3" height="7" fill="{socks}"/>
<rect x="-5.5" y="-17" width="11" height="6" rx="1.5" fill="{shorts}"/>
<rect x="-6" y="-29" width="12" height="13" rx="3" fill="{body}"/>
<rect x="-6" y="-29" width="12" height="2.2" rx="1" fill="{trim}"/>
<circle cx="0" cy="-33" r="4" fill="#3a2a22"/></g>'''
ball = '<circle cx="728" cy="640" r="5" fill="#FFFFFF"/>'

# ---------- the manager ----------
S = (440, 578); Wr = (792, 446)
dx, dy = Wr[0] - S[0], Wr[1] - S[1]; L = math.hypot(dx, dy); u = (dx / L, dy / L); n = (-u[1], u[0])
if n[1] < 0: n = (-n[0], -n[1])
P = lambda p, v, k: (p[0] + v[0] * k, p[1] + v[1] * k)
a1, a2, a3, a4 = P(S, n, 66), P(Wr, n, 40), P(Wr, n, -40), P(S, n, -64)
mid = P(S, u, L * .5)
sleeve = f'M{a4[0]:.0f} {a4[1]:.0f} Q{P(mid,n,-58)[0]:.0f} {P(mid,n,-58)[1]:.0f} {a3[0]:.0f} {a3[1]:.0f} L{a2[0]:.0f} {a2[1]:.0f} Q{P(mid,n,56)[0]:.0f} {P(mid,n,56)[1]:.0f} {a1[0]:.0f} {a1[1]:.0f} Z'
body = 'M252 526 C204 530 160 560 140 624 L104 1040 L566 1040 L552 760 C544 690 522 642 492 612 L462 566 C436 538 404 527 382 525 Z'
collar = 'M246 534 Q318 494 390 534 L398 580 Q318 548 238 580 Z'
sil_shapes = [f'<path d="{body}"/>', f'<path d="{sleeve}"/>', f'<path d="{collar}"/>']
ang = math.degrees(math.atan2(u[1], u[0]))
# hand (skin) — knuckles + curled fingers + extended index finger
H = P(Wr, u, 30)
hand = f'''<g transform="translate({H[0]:.1f} {H[1]:.1f}) rotate({ang:.1f}) scale(.86)">
  <path d="M-14 -24 Q20 -30 34 -16 Q44 -4 36 14 Q24 30 -6 28 Q-20 26 -20 4 Z" fill="url(#skin)"/>
  <path d="M30 -18 L96 -24 Q106 -24 106 -16 Q106 -9 96 -9 L32 -4 Z" fill="url(#skin)"/>
  <path d="M10 6 Q30 4 36 12 M4 16 Q24 16 30 22" stroke="#6E4632" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
  <path d="M-12 -24 Q20 -32 36 -18 L96 -24 Q104 -24 106 -18" stroke="#FFE2C4" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/>
</g>'''
cuff_a, cuff_b = P(Wr, u, -6), P(Wr, u, 8)
cuff = f'<path d="M{P(cuff_a,n,40)[0]:.0f} {P(cuff_a,n,40)[1]:.0f} L{P(cuff_b,n,36)[0]:.0f} {P(cuff_b,n,36)[1]:.0f} L{P(cuff_b,n,-36)[0]:.0f} {P(cuff_b,n,-36)[1]:.0f} L{P(cuff_a,n,-40)[0]:.0f} {P(cuff_a,n,-40)[1]:.0f} Z" fill="#E9EDF2"/>'
# sleeve folds
folds = ''
for k in (.28, .46, .63):
    c = P(S, u, L * k)
    p0, p1 = P(c, n, -50), P(P(c, u, 22), n, 30)
    folds += f'<path d="M{p0[0]:.0f} {p0[1]:.0f} Q{P(c,u,26)[0]:.0f} {P(c,u,26)[1]:.0f} {p1[0]:.0f} {p1[1]:.0f}" stroke="#000" stroke-opacity=".45" stroke-width="7" fill="none" stroke-linecap="round"/>'

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060B"/><stop offset=".2" stop-color="#0A1422"/><stop offset=".5" stop-color="#16202C"/></linearGradient>
  <radialGradient id="haze" cx="50%" cy="18%" r="65%"><stop offset="0" stop-color="#EEF3FA" stop-opacity=".42"/><stop offset=".45" stop-color="#DDE6F2" stop-opacity=".1"/><stop offset="1" stop-color="#DDE6F2" stop-opacity="0"/></radialGradient>
  <linearGradient id="standShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity=".02"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <filter id="crowd" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.85 1.35" numOctaves="2" seed="11"/>
    <feColorMatrix type="matrix" values="0.95 0 0 0 -0.12  0.25 0.45 0 0 -0.1  0.2 0 0.55 0 -0.08  0 0 0 0 1"/>
  </filter>
  <filter id="bloom" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="8"/><feComponentTransfer><feFuncA type="linear" slope="2.2"/></feComponentTransfer></filter>
  <filter id="bigbloom" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="twinkle" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/><feComponentTransfer><feFuncA type="linear" slope="1.8"/></feComponentTransfer></filter>
  <filter id="shaftblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
  <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4DA" stop-opacity=".35"/><stop offset=".5" stop-color="#FFF4DA" stop-opacity=".08"/><stop offset="1" stop-color="#FFF4DA" stop-opacity="0"/></linearGradient>
  <filter id="dof" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="crowdsoft" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="0.9"/></filter>
  <filter id="facesoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="rimblur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <filter id="hairtex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.9" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 0.95"/></filter>
  <clipPath id="cu"><path d="{stands_upper}"/></clipPath>
  <clipPath id="cl"><path d="{stands_lower}"/></clipPath>
  <clipPath id="sil">{''.join(sil_shapes)}</clipPath>
  <radialGradient id="hair" cx="64%" cy="24%" r="85%"><stop offset="0" stop-color="#E4E6E8"/><stop offset=".4" stop-color="#ADB2B7"/><stop offset=".8" stop-color="#767C83"/><stop offset="1" stop-color="#4F555C"/></radialGradient>
  <linearGradient id="skinface" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E4F3C"/><stop offset=".6" stop-color="#C08566"/><stop offset="1" stop-color="#E2AE8C"/></linearGradient>
  <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2B08E"/><stop offset="1" stop-color="#9A6447"/></linearGradient>
  <linearGradient id="coatShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".55" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
</defs>
<g filter="url(#dof)">
  <rect width="{W}" height="{W}" fill="url(#sky)"/>
  <rect x="0" y="0" width="{W}" height="{W}" filter="url(#crowd)" clip-path="url(#cu)"/>
  <rect x="0" y="0" width="{W}" height="{W}" filter="url(#crowd)" clip-path="url(#cl)" opacity=".95"/>
  <path d="{stands_upper}" fill="#05070D" opacity=".62"/>
  <path d="{stands_lower}" fill="#05070D" opacity=".55"/>
  <path d="{stands_upper}" fill="url(#standShade)"/>
  <path d="{stands_lower}" fill="url(#standShade)"/>
  <g stroke="#000" stroke-opacity=".18" stroke-width="1.5" fill="none">{rows}</g>
  <g stroke="#0A0D12" stroke-opacity=".55" stroke-width="5">{aisles}</g>
  <g filter="url(#twinkle)" opacity=".95">{seat_lights}</g>
  {seat_lights}
  <g filter="url(#twinkle)">{stars}</g>{stars}
  <g fill="#0A0E14">{band(tier1, tier1, 0, 18)}</g>
  <g fill="#F2B33D" opacity=".75">{band(tier1, tier1, 6, 11)}</g>
  <g fill="#05080D">{band(lambda x: roof(x) - 70, roof, 0, 0)}</g>
  <g filter="url(#bigbloom)" opacity=".75">{roofglow}</g>
  <g filter="url(#bloom)">{lights}</g>
  {lights}
  <g filter="url(#shaftblur)" opacity=".55">{shafts}</g>
  <g filter="url(#bloom)">{boards}</g>
  {boards}
  {stripes}
  <polyline points="{far_line}" fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="3"/>
  <path d="M640 {pitch_top(640)+4:.0f} L860 1040" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="5"/>
  <ellipse cx="712" cy="630" rx="250" ry="52" fill="none" stroke="#FFFFFF" stroke-opacity=".65" stroke-width="4"/>
  <ellipse cx="712" cy="630" rx="5" ry="2.5" fill="#FFFFFF" opacity=".8"/>
  {players}{ball}
  <rect width="{W}" height="{W}" fill="url(#haze)"/>
</g>
<!-- manager -->
<ellipse cx="330" cy="1010" rx="300" ry="40" fill="#000" opacity=".35" filter="url(#soft)"/>
<g>
  <g fill="#12161D">{''.join(sil_shapes)}</g>
  <g clip-path="url(#sil)"><g fill="#B8C9DF" opacity=".75">{''.join(sil_shapes)}</g><g fill="#12161D" transform="translate(-9 10)" filter="url(#rimblur)">{''.join(sil_shapes)}</g>
    <rect x="80" y="480" width="520" height="580" fill="url(#coatShade)"/>
    <path d="M318 560 V1040" stroke="#000" stroke-opacity=".5" stroke-width="5"/>
    <path d="M318 900 V1040" stroke="#000" stroke-opacity=".6" stroke-width="12"/>
    <path d="M200 640 Q250 700 238 820 M430 640 Q400 700 412 820" stroke="#000" stroke-opacity=".35" stroke-width="8" fill="none" stroke-linecap="round"/>
    {folds}
  </g>
  {cuff}
  <rect x="{P(cuff_a,u,-2)[0]-4:.0f}" y="{P(cuff_a,u,-2)[1]-34:.0f}" width="10" height="20" rx="3" fill="#D9DEE4" transform="rotate({ang:.0f} {P(cuff_a,u,-2)[0]:.0f} {P(cuff_a,u,-2)[1]:.0f})"/>
  {hand}
  <g transform="rotate(3 320 430)">
    <path id="headshape" d="M318 334 C360 334 394 356 404 392 C406 400 410 404 409 410 C408 416 410 422 416 432 L429 451 C431 455 425 459 414 459 L417 464 L403 470 L416 482 C416 489 411 495 404 501 C392 513 372 519 352 517 L346 544 L280 544 C268 522 243 492 239 440 C235 380 270 334 318 334 Z" fill="url(#skinface)"/>
    <clipPath id="fc"><use href="#headshape"/></clipPath>
    <g clip-path="url(#fc)">
      <ellipse cx="388" cy="452" rx="26" ry="22" fill="#B8503F" opacity=".22" filter="url(#facesoft)"/>
      <ellipse cx="396" cy="414" rx="14" ry="9" fill="#5A3428" opacity=".45" filter="url(#facesoft)"/>
      <path d="M352 517 C372 519 392 513 404 501 L420 520 L340 560 Z" fill="#000" opacity=".35"/>
      <path d="M404 392 C406 400 410 404 409 410 C408 416 410 422 416 432 L429 451" stroke="#FFE6CF" stroke-width="5" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M415 478 C415 487 411 495 404 501" stroke="#FFE6CF" stroke-width="4" fill="none" opacity=".6"/>
      <path d="M408 436 Q394 452 400 472" stroke="#7A4434" stroke-width="3.5" fill="none" opacity=".75" stroke-linecap="round"/>
      <path d="M384 421 q-6 2 -10 6" stroke="#7A4434" stroke-width="1.8" opacity=".35" fill="none" stroke-linecap="round"/>
      <path d="M372 500 q14 4 28 -4" stroke="#6A3A2C" stroke-width="2" opacity=".4" fill="none"/>
    </g>
    <path d="M417 464 L403 470 L416 482 Z" fill="#3A1410"/>
    <path d="M406 469 L415 466 L415 469.5 Z" fill="#EDE7DE"/>
    <path d="M394 415 q5 -3 10 -1" stroke="#2B1C17" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M384 404 Q396 399 407 402" stroke="#A9AEB3" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path id="hairshape" d="M318 328 C358 328 390 346 400 378 C388 372 374 376 366 390 C362 398 362 408 364 418 L366 452 C360 456 354 452 350 446 C344 470 344 490 350 506 Q330 512 300 512 Q292 504 284 512 C262 500 240 474 237 432 C233 370 270 328 318 328 Z" fill="url(#hair)"/>
    <clipPath id="hc"><use href="#hairshape"/></clipPath>
    <rect x="228" y="320" width="190" height="200" filter="url(#hairtex)" clip-path="url(#hc)" opacity=".5"/>
    <path d="M246 470 Q300 520 352 490 L356 530 L240 530 Z" fill="#000" opacity=".22" clip-path="url(#hc)"/>
    <path d="M340 344 Q382 352 396 376" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M246 398 Q240 428 250 452" stroke="#2A2E33" stroke-opacity=".4" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M342 428 C356 424 362 440 360 456 C358 470 352 478 344 476 C338 470 336 440 342 428 Z" fill="#B47A5D"/>
    <path d="M346 438 C354 440 354 456 350 466" stroke="#7E4B38" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
    <path d="M352 430 C362 440 362 460 354 474" stroke="#FFD9BC" stroke-width="2" fill="none" opacity=".6"/>
  </g>
  <path d="M246 534 Q318 494 390 534 L398 580 Q318 548 238 580 Z" fill="#161B23"/>
  <path d="M246 534 Q318 494 390 534" stroke="#B8C9DF" stroke-opacity=".45" stroke-width="3" fill="none"/>
</g>
<rect width="{W}" height="{W}" fill="url(#vig)"/>
</svg>'''
open('r1.svg', 'w').write(svg)
print('ok', len(svg))
