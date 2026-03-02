import re
path=r'd:\Disco\Programação\index-js2.1\modules\MediaProcessor.ts'
with open(path,'rb') as f:
    data=f.read()
for m in re.finditer(b'[\x05\x08]', data):
    line=data.count(b'\n',0,m.start())+1
    print('found',hex(data[m.start()]),'at',m.start(),'line',line)
