import re
class tokens_typs:
    wite_speis=0
    symbol="symbol"
    key_word="keyword"
    name="identifier"
    number="integrConstant"
    string="StringConstant"

class tokenazer_data:
    symbols="{()[]}.,;+-*/&|~<>="
    symbols=list(symbols)
    key_words=('class','constructor','function','method', 'field','static','var','int','char', 'boolean','void','true','false','null','this','let','do','if','else','while','return')
    name_first_letter="[a-zA-Z_]"
    name_letter="[a-zA-Z_0-9]"
    tokens_ptren=[[tokens_typs.wite_speis,"[\t \n]+"],
                  [tokens_typs.wite_speis,"//.*\n"],
                  [tokens_typs.wite_speis,"/[*](.|\n)*?[*]/"],
                  [tokens_typs.name,name_first_letter+name_letter+"*"],
                  [tokens_typs.number,"[0-9]+"],
                  [tokens_typs.string,'"[^"\n]*"']]
    name_first_letter=re.compile(name_first_letter)
    name_letter=re.compile(name_letter)
    for token_ptren in tokens_ptren:
        token_ptren[1]=re.compile(token_ptren[1])
    

def tokenaiz(file_naim):
    f=open(file_naim)
    file=f.read()
    strt_token=0
    tokens=[]
    while strt_token!=len(file):
        (token,token_type,strt_token)=next_token(strt_token,file)
        if token_type!=tokens_typs.wite_speis:
            tokens=tokens+[(token,token_type)]
    return tokens

def next_token(strt_token,file):
    for key_word in tokenazer_data.key_words:
        end_token=strt_token+len(key_word)
        if file[strt_token:end_token]==key_word:
            if not(tokenazer_data.name_letter.match(file[end_token])):
                return key_word,tokens_typs.key_word,end_token
    for token_ptren in tokenazer_data.tokens_ptren:
        mat=token_ptren[1].match(file,strt_token)
        if mat:
            #if len(mat.group())==0:
                #huston_we_have_a_problem=1
            return mat.group(),token_ptren[0],strt_token+len(mat.group())
    if file[strt_token] in tokenazer_data.symbols:
        return file[strt_token],tokens_typs.symbol,strt_token+1


#print(tokenaiz("C:\\Users\\aizenr\\Dropbox\\Programs\\nand2tetris\\projects\\10\\Square\\main.jack"))
#tokens=tokenaiz("C:/Users/Meir/Dropbox/code/nand2tetris/projects/first_round/11/ConvertToBin/Array.jack")

#ashdkasd=1