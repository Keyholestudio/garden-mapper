import sys

with open(r'C:\Users\RG\.openclaw\workspace\projects\garden-planner\app\src\components\LogoBar.jsx', encoding='utf-8') as f:
    content = f.read()

# Mobile dropdown: sign-out button with 6-space indent (door emoji U+1F6AA)
old1 = (
    '                  <button className="profile-menu-item" onClick={() => { onSignOut?.(); closeMenu(); }}>\n'
    '                    <span className="profile-menu-icon">\U0001f6aa</span>\n'
    '                    <span>Sign Out</span>\n'
    '                  </button>'
)
new1 = (
    '                  <button className="profile-menu-item" onClick={() => { onOpenAccount?.(); closeMenu(); }}>\n'
    '                    <span className="profile-menu-icon">\u2699\ufe0f</span>\n'
    '                    <span>Account</span>\n'
    '                  </button>\n'
    '                  <button className="profile-menu-item" onClick={() => { onSignOut?.(); closeMenu(); }}>\n'
    '                    <span className="profile-menu-icon">\U0001f6aa</span>\n'
    '                    <span>Sign Out</span>\n'
    '                  </button>'
)

# Desktop dropdown: sign-out button with 4-space indent (bicycle emoji U+1F6B2)
old2 = (
    '                <button className="profile-menu-item" onClick={() => { onSignOut?.(); closeMenu(); }}>\n'
    '                  <span className="profile-menu-icon">\U0001f6b2</span>\n'
    '                  <span>Sign Out</span>\n'
    '                </button>'
)
new2 = (
    '                <button className="profile-menu-item" onClick={() => { onOpenAccount?.(); closeMenu(); }}>\n'
    '                  <span className="profile-menu-icon">\u2699\ufe0f</span>\n'
    '                  <span>Account</span>\n'
    '                </button>\n'
    '                <button className="profile-menu-item" onClick={() => { onSignOut?.(); closeMenu(); }}>\n'
    '                  <span className="profile-menu-icon">\U0001f6b2</span>\n'
    '                  <span>Sign Out</span>\n'
    '                </button>'
)

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Mobile dropdown: OK')
else:
    print('Mobile dropdown: NOT FOUND')
    # Debug: find onSignOut occurrences
    for i, line in enumerate(content.splitlines(), 1):
        if 'onSignOut' in line:
            print(f'  Line {i}: {repr(line)}')

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Desktop dropdown: OK')
else:
    print('Desktop dropdown: NOT FOUND')

with open(r'C:\Users\RG\.openclaw\workspace\projects\garden-planner\app\src\components\LogoBar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('File written.')
