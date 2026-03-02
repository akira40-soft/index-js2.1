<<<<<<< HEAD
import codecs
path=r'D:\Disco\Programação\index-js2.1\modules\MediaProcessor.ts'
with codecs.open(path,'r','utf-8') as f:
    lines=f.readlines()
for i in range(1184,1196):
    l=lines[i]
    codes=[ord(ch) for ch in l]
    print(i+1, l.rstrip())
    print('codes', codes)
=======
import codecs
path=r'D:\Disco\Programação\index-js2.1\modules\MediaProcessor.ts'
with codecs.open(path,'r','utf-8') as f:
    lines=f.readlines()
for i in range(1184,1196):
    l=lines[i]
    codes=[ord(ch) for ch in l]
    print(i+1, l.rstrip())
    print('codes', codes)
>>>>>>> bca33df3e80ad01e3a871bb67a7d0a8ff9a621a3
