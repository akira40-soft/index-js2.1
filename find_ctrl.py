<<<<<<< HEAD
import re
path=r'd:\Disco\Programação\index-js2.1\modules\MediaProcessor.ts'
with open(path,'rb') as f:
    data=f.read()
for m in re.finditer(b'[\x05\x08]', data):
    line=data.count(b'\n',0,m.start())+1
    print('found',hex(data[m.start()]),'at',m.start(),'line',line)
=======
import re
path=r'd:\Disco\Programação\index-js2.1\modules\MediaProcessor.ts'
with open(path,'rb') as f:
    data=f.read()
for m in re.finditer(b'[\x05\x08]', data):
    line=data.count(b'\n',0,m.start())+1
    print('found',hex(data[m.start()]),'at',m.start(),'line',line)
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
