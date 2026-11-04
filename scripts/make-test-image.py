from PIL import Image, ImageDraw, ImageFont
import os

out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'test-artifacts')
os.makedirs(out_dir, exist_ok=True)

img = Image.new('RGB', (1000, 440), '#ededed')
d = ImageDraw.Draw(img)
font_path = r'C:\Windows\Fonts\msyh.ttc'
font = ImageFont.truetype(font_path, 28)
small = ImageFont.truetype(font_path, 22)

d.rounded_rectangle([40, 40, 960, 400], radius=24, fill='white', outline='#d0d0d0', width=2)
d.text((70, 70), '李姐', font=small, fill='#666666')
d.text((70, 115), '明天下午3点去金色花园5栋101安装门窗，', font=font, fill='#111111')
d.text((70, 165), '记得带玻璃胶和水平仪。', font=font, fill='#111111')
d.text((70, 215), '装完拍两张照片发我。', font=font, fill='#111111')

out = os.path.join(out_dir, 'ai-input.png')
img.save(out)
print(out)
