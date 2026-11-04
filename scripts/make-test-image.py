from PIL import Image, ImageDraw, ImageFont
import os

out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'test-artifacts')
os.makedirs(out_dir, exist_ok=True)

font_path = r'C:\Windows\Fonts\msyh.ttc'
font = ImageFont.truetype(font_path, 28)
small = ImageFont.truetype(font_path, 22)


def make_image(name, lines):
    img = Image.new('RGB', (1000, 440), '#ededed')
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, 960, 400], radius=24, fill='white', outline='#d0d0d0', width=2)
    d.text((70, 70), '李姐', font=small, fill='#666666')
    y = 115
    for line in lines:
        d.text((70, y), line, font=font, fill='#111111')
        y += 50
    out = os.path.join(out_dir, name)
    img.save(out)
    print(out)


make_image(
    'ai-input.png',
    [
        '明天下午3点去金色花园5栋101安装门窗，',
        '记得带玻璃胶和水平仪。',
        '装完拍两张照片发我。'
    ]
)

make_image(
    'ai-input-2.png',
    [
        '地址：金色花园5栋101，门禁密码 2468。',
        '玻璃胶和水平仪别忘了带。'
    ]
)
