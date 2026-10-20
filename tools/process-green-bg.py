from PIL import Image
import numpy as np, sys, os

OUT_SIZE=512; PADDING=20
CHROMA=np.array([0,255,0],dtype=np.float32); TOL=80; SOFT=40

def process(inp, outp):
    print(f'Input: {os.path.basename(inp)}')
    img=Image.open(inp).convert('RGBA')
    data=np.array(img,dtype=np.float32); h,w=data.shape[:2]
    r,g,b=data[:,:,0],data[:,:,1],data[:,:,2]
    dist=np.sqrt((r-0)**2+(g-255)**2+(b-0)**2)
    data[:,:,3]=np.where(dist<TOL,0,np.where(dist<TOL+SOFT,((dist-TOL)/SOFT*255).clip(0,255),255)).astype(np.uint8)
    data[h-150:h,w-150:w,3]=0; data[h-150:h,0:150,3]=0; data[h-30:h,:,3]=0
    result=Image.fromarray(data.clip(0,255).astype(np.uint8),'RGBA')
    arr2=np.array(result); mask=arr2[:,:,3]>128
    rows=np.any(mask,axis=1); cols=np.any(mask,axis=0)
    r1,r2=np.where(rows)[0][[0,-1]]; c1,c2=np.where(cols)[0][[0,-1]]
    cropped=result.crop((c1,r1,c2+1,r2+1))
    cw,ch=cropped.size; scale=(OUT_SIZE-2*PADDING)/max(cw,ch)
    nw,nh=int(cw*scale),int(ch*scale)
    resized=cropped.resize((nw,nh),Image.LANCZOS)
    canvas=Image.new('RGBA',(OUT_SIZE,OUT_SIZE),(0,0,0,0))
    ox=(OUT_SIZE-nw)//2; oy=(OUT_SIZE-nh)//2
    canvas.paste(resized,(ox,oy),resized); canvas.save(outp)
    top=oy; bot=OUT_SIZE-nh-oy; left=ox; right=OUT_SIZE-nw-ox
    status='[OK]' if abs(top-bot)<=10 and abs(left-right)<=10 else '[WARN]'
    print(f'  top={top} bot={bot} left={left} right={right} {status}')

process(sys.argv[1], sys.argv[2])
