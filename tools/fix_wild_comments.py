import re

with open('tools/sticker-generate-one.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix lines where the comment sits mid-tuple between the plant_type arg and the colour string
# Pattern to match: "plant",  # ?? WILD - do last   "colour...", "desc..."),
# or              : "deciduous",  # ?? WILD - do last "colour...", "desc..."),
pattern = r'("(?:plant|deciduous|evergreen)",)\s+# \?\? WILD - do last\s+(".*?",\s+".*?"\),)'
replacement = r'\1 \2  # ?? WILD - do last'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

count = content.count('# ?? WILD - do last')
new_count = new_content.count('# ?? WILD - do last')
print(f'Total # ?? WILD comments: {count} -> {new_count} (should be same)')

# Verify syntax
import ast
try:
    ast.parse(new_content)
    print('Syntax OK!')
except SyntaxError as e:
    print(f'Syntax error: {e}')

with open('tools/sticker-generate-one.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done')
