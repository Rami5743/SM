import re
import os

def add_tabs(s):
    if s=="":
        return ""
    s_tabs=list(s)
    for i in range(len(s)-1):
        if s_tabs[i]=="\n":
            s_tabs[i]=s_tabs[i]+"\t"
    return "\t"+str_list(s_tabs)
def str_list(lis_of_str):
    string=""
    for i in range(len(lis_of_str)):
        string=string+lis_of_str[i]
    return string

#dir_list = os.listdir(path)
class sm_trnsleitor:
    mov_sp2A="//SP=A\n"+add_tabs("@SP\nA=M\n")
    pop_D="//pop D\n"+ add_tabs(mov_sp2A+"D=M\n@SP\nAM=M-1\n")
    push_D="//push D\n"+add_tabs("@SP\nAM=M+1\nM=D\n")
    push_A="//push A\n"+add_tabs("D=A\n"+push_D)
    push_M="//push M\n"+add_tabs("D=M\n"+push_D)

    simpl_cmds={"+":pop_D+"M=D+M\n","-":pop_D+"M=M-D\n","&":pop_D+"M=D&M\n","|":pop_D+"M=D|M\n","(-)":mov_sp2A+"M=-M\n","~":mov_sp2A+"M=!M\n"}
    simpl_cmds["<"]=simpl_cmds["-"]
    simpl_cmds[">"]=pop_D+"M=D-M\n"
    simpl_cmds["=="]="//-\n"+add_tabs(simpl_cmds["-"])+"D=-M\nM=M|D\nM=!M\n"
    simpl_cmds["[]"]=mov_sp2A+"A=M\nD=M\n"+mov_sp2A+"M=D\n"
    simpl_cmds["->[]"]=pop_D+"A=M\nM=D\n@SP\nM=M-1\n"


    empty_cmd=0
    simpl_cmd=1
    push_const_cmd=2
    push_glob_var_cmd=3
    push_loc_var_cmd=4
    pop_glob_var_cmd=5
    pop_loc_var_cmd=6
    lable_cmd=7
    jmp_cmd=8
    cond_jmp_cmd=9
    call_cmd=10
    declaration_cmd=11
    return_cmd=12

    cmd_tamplades=[[return_cmd,'<--'],
                   [push_const_cmd, '<-([0-9])*'], 
                   [push_loc_var_cmd, '<-@(.*)'], 
                   [push_glob_var_cmd, '<-(.*)'], 
                   [pop_loc_var_cmd, '->@(.*)'], 
                   [pop_glob_var_cmd, '->(.*)'], 
                   [lable_cmd, '(.*):'], 
                   [jmp_cmd, '-->(.*)'], 
                   [cond_jmp_cmd, '\?-->(.*)'], 
                   [declaration_cmd, '!(.*)\((.*)\)(.*)'], 
                   [call_cmd, '(.*)']]
    for i in range(len(cmd_tamplades)):
        cmd_tamplades[i][1]=re.compile("^"+cmd_tamplades[i][1]+"$")

    def __init__(self,fold):
        self.call_tim=-1
        self.fold=fold
        self.file_out=open(fold+".asm","w")
        mov_A2SP="//SP=A\n"+add_tabs("D=A\n@SP\nM=D\n")
        inif_loop="//infinite loop\n"+add_tabs("@end\n(end)\n0;JMP\n")
        self.file_out.write("//inisialisation code\n"+add_tabs("@256\n"+mov_A2SP+"//call Sys.init\n"+add_tabs(self.call("Sys.init"))+inif_loop))
    def translate(self):
        dir_list=os.listdir(self.fold)
        for f in dir_list:
            name,ext=os.path.splitext(f)
            if ext==".sm":
                self.translate_file(self.fold+"/"+f)
        self.file_out.close

    def translate_file(self,file_name):
        f=open(file_name)
        self.in_file=f
        self.is_finished=False
        while not(self.is_finished):
            self.pars_next_line()
            self.translate_line()
    
    def get_next_line(self):
        self.line=self.in_file.readline()
        if not(self.line):
            self.is_finished=True
            self.line=""
        self.line=cline_line(self.line)
    def pars_curent_line(self):
        if self.line=="":
            self.tip=sm_trnsleitor.empty_cmd
            return
        try:
            self.tip=sm_trnsleitor.simpl_cmd
            self.asm_str=sm_trnsleitor.simpl_cmds[self.line]
            return
        except:
            pass
        for tamplade in sm_trnsleitor.cmd_tamplades:
            #parts=heack_asembler.parser_re.match(self.line).groups()
            mat=tamplade[1].match(self.line)
            if mat:
                self.tip=tamplade[0]
                parts=mat.groups()
                if tamplade[0]==sm_trnsleitor.declaration_cmd:
                    self.funtion_name=parts[0]
                    arg=my_split(parts[1],",") 
                    lcl=my_split(parts[2],",") 
                    self.lcl_nam=len(lcl)
                    self.arg_nam=len(arg)
                    value=deep_num2str(list(range(self.arg_nam))+list(range(self.arg_nam+2,self.arg_nam+self.lcl_nam+2)))
                    self.local_vars=dict(zip(arg+lcl,value)) 
                elif tamplade[0]!=sm_trnsleitor.return_cmd:
                    self.prmetr=parts[0]
                return
    def pars_next_line(self):
        self.get_next_line()
        #if self.line=="sin":
        #   ghjgjhg=1
            
        self.pars_curent_line()
    def translate_line(self):
        if self.tip==sm_trnsleitor.simpl_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.asm_str))
        elif self.tip==sm_trnsleitor.push_const_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.push_const(self.prmetr)))
        elif self.tip==sm_trnsleitor.push_glob_var_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.push_glob_var()))
        elif self.tip==sm_trnsleitor.push_loc_var_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.push_loc_var()))
        elif self.tip==sm_trnsleitor.pop_glob_var_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.pop_glob_var()))
        elif self.tip==sm_trnsleitor.pop_loc_var_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.pop_loc_var()))
        elif self.tip==sm_trnsleitor.lable_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.lable()))
        elif self.tip==sm_trnsleitor.jmp_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.jmp()))
        elif self.tip==sm_trnsleitor.cond_jmp_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.cond_jmp()))
        elif self.tip==sm_trnsleitor.call_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.call(self.prmetr)))
        elif self.tip==sm_trnsleitor.declaration_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.declaration()))
        elif self.tip==sm_trnsleitor.return_cmd:
            self.file_out.write("//"+self.line +"\n"+add_tabs(self.ret()))

        
    def push_const(self,const):
        return "@"+const+"\n"+sm_trnsleitor.push_A
    def push_asm_var(self,var):
        return "//push asembly varibale " +var+"\n"+add_tabs("@"+var+"\n"+sm_trnsleitor.push_M)
    def pop_asm_var(self,var):
        return  "//pop asembly varibale " +var + "\n"+add_tabs(sm_trnsleitor.pop_D+"@"+var+"\n"+"M=D\n")

    def push_glob_var(self):
        return self.push_asm_var("SM."+self.prmetr)
    def push_loc_var(self):
        add_LCL2A="//A=A+LCL\n"+add_tabs("D=A\n@LCL\nA=D+M\n")
        return "@"+self.local_vars[self.prmetr]+"\n"+add_LCL2A+sm_trnsleitor.push_M
    def pop_glob_var(self):
        return self.pop_asm_var("SM."+self.prmetr)
    def pop_loc_var(self):
        mov_A_plus_LCL2tmp="//tmp=A+LCL\n"+add_tabs("D=A\n@LCL\nD=D+M\n@tmp\nM=D\n")
        return mov_A_plus_LCL2tmp+sm_trnsleitor.pop_D+"@tmp\nA=M\nM=D\n"
    def lable(self):
        return "(LABEL."+self.funtion_name+"."+self.prmetr+")"+"\n"
    def jmp(self):
        return "@LABEL."+self.funtion_name+"."+self.prmetr+"\n0;JMP\n"
    def cond_jmp(self):
        return sm_trnsleitor.pop_D+"@LABEL."+self.funtion_name+"."+self.prmetr+"\nD;JLT\n"
    def call(self,funtion_name):
        self.call_tim=self.call_tim+1
        return_lable="call."+str(self.call_tim)
        return self.push_asm_var("LCL")+"//push constant "+return_lable+"\n" +add_tabs(self.push_const(return_lable))+"@FUNTION."+funtion_name+"\n0;JMP\n("+return_lable+")\n"
    def declaration(self):
        mov_sp2LCL="//LCL=SP\n"+ add_tabs("@SP\nD=M\n@LCL\nM=D\n")
        sab_A_from_LCL="//LCL=LCL-A\n"+ add_tabs("D=A\n@LCL\nM=M-D\n")
        push_0=""
        for i in range(self.lcl_nam):
            push_0=push_0+"//push 0\n"+add_tabs(self.push_const("0"))
        push_0="// push 0, " + str(self.lcl_nam) + " times\n"+add_tabs(push_0)
        return "("+"FUNTION."+self.funtion_name+")\n"+mov_sp2LCL+"@"+str(self.arg_nam+1)+"\n"+sab_A_from_LCL+push_0
    def ret(self):
        mov2SP_LCL_minus_1="//SP=LCL-1\n"+add_tabs("@LCL\nD=M\n@SP\nM=D-1\n")
        add_SP2A="//A=A+SP\n"+add_tabs("D=A\n@SP\nA=D+M\n")
        mov_M2LCL="//LCL=M\n"+add_tabs("D=M\n@LCL\nM=D\n")
        return self.pop_asm_var("tmp")+mov2SP_LCL_minus_1+"@"+str(self.arg_nam+1)+"\n"+add_SP2A+mov_M2LCL+self.push_asm_var("tmp")+"@"+str(self.arg_nam+1)+"\n"+add_SP2A+"A=M\n0;JMP\n"

    


def cline_line(line):
    if line!="":
        if line[-1]=="\n":
            line=line[:-1]
        line=ereaz_coman(line)
        line=ereaz_chractr(line," ")
        line=ereaz_chractr(line,"\t")
    return line

def ereaz_chractr(line,chractr):
    ereazd_line=""
    for leter in line:
        if leter!=chractr:
            ereazd_line=ereazd_line+leter
    return ereazd_line

def ereaz_coman(line):
    wer_coman_list=serch_str(line,"//")
    if wer_coman_list!=[]:
        wer_coman=wer_coman_list[0]
        return line[0:wer_coman]
    return line

def serch_str(line,word):
    foud_pleases=[]
    for i in range(len(line)):
        if line[i:i+len(word)]==word:
            foud_pleases=foud_pleases+[i]
    return foud_pleases

def deep_str2int(l):
    if type(l)==list:
        for i in range(len(l)):
            l[i]=deep_str2int(l[i])
    else:
        try:
            l=int(l)
        except:
            pass
    return l

def deep_num2str(l):
    if type(l)==list:
        for i in range(len(l)):
            l[i]=deep_num2str(l[i])
    else:
        try:
            l=str(l)
        except:
            pass
    return l    

def translate_fold(fold):
    trnsleit=sm_trnsleitor(fold)
    trnsleit.translate()

def my_split(line,sep):
    return ereaz_from_list(line.split(sep),"")


def ereaz_from_list(lis,to_eraez):
    ereazd_list=[]
    for elment in lis:
        if elment!=to_eraez:
            ereazd_list=ereazd_list+[elment]
    return ereazd_list    


#translate_fold("C:\\Dropbox\\Programs\\nand2tetris\\projects\\08\\FunctionCalls\\FibonacciElement_sm")
#translate_fold("C:\\Dropbox\\Programs\\nand2tetris\\projects\\08\\FunctionCalls\\FibonacciElement_sm")
#translate_fold("C:/Users/Meir/Dropbox/code/nand2tetris/SM/test1")
#x=3
#s="fghd\ndf\nete"
#print(s)
#print(add_tabs(s))