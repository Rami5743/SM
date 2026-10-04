import os
import sys

import tokenizer as tokenazr

class compaler:
    op_list=list("+-*/&|<>=")
    op_dict = dict(zip(op_list,op_list))
    op_dict["="]="=="
    op_dict["*"]="Math.multiply"
    op_dict["/"]="Math.divide"
    unary_ops={"~":"~","-":"(-)"}
    def __init__(self,file_name):
        self.tokens=tokenazr.tokenaiz(file_name+".jack")
        self.file_out=open(file_name+".sm","w")
        self.pos=0
        self.leibl_caunter=0
    def nexst_token(self):
        return self.tokens[self.pos+1][0]
    def token(self):
        return self.tokens[self.pos][0]
    def token_typ(self):
        return self.tokens[self.pos][1]
    def adv(self):
        self.pos+=1
    def write_token(self):
        self.file_out.write("<"+self.token_typ()+"> "+self.token()+" </"+self.token_typ()+">\n")
        self.adv()
    def fild_num(self):
        num = 0
        for class_var in self.class_vars:
            if self.class_vars[class_var][0] == True:
                num = num + 1
        return num
    
    
    
    def copieleClass(self):
        self.adv()
        self.class_name=self.token()
        self.adv()
        self.adv()
        self.class_vars={}
        self.fild_nam=0
        while (self.token()=="static") or (self.token()=="field"):
            self.copieleClassVarDec()
        #self.file_out.write("</class>")
        #self.close()
        while (self.token()!="}"):
            self.copieleSubDec()
        self.adv()
        self.adv()
        #self.close()
    def copieleClassVarDec(self):
        if self.token()=="static":
            self.adv()
            var_type=self.token()
            self.adv()
            self.class_vars[self.token()]=[False,self.class_name+"."+self.token(),var_type]
            #[isFilde, sm_name/number,type]
            self.adv()
            while self.token()!=";":
                self.adv()
                self.class_vars[self.token()]=[False,self.class_name+"."+self.token(),var_type]
                self.adv()
        else:
            self.adv()
            var_type=self.token()
            self.adv()
            self.class_vars[self.token()]=[True,str(self.fild_nam),var_type]
            self.fild_nam+=1
            self.adv()
            while self.token()!=";":
                self.adv()
                self.class_vars[self.token()]=[True,str(self.fild_nam),var_type]
                self.fild_nam+=1
                self.adv()
        self.adv()
    def copieleSubDec(self):
        self.sab_type=self.token()
        self.adv()
        self.out_type=self.token()
        self.adv()
        self.file_out.write("!"+self.class_name+"."+self.token()+"(")
        self.adv()
        if self.sab_type=="method":
            self.sab_arg={"this":self.class_name}
            self.file_out.write("this,")
        else:
            self.sab_arg={}
        self.adv()
        self.copieleParList()
        self.file_out.write(")")
        self.adv()
        if self.sab_type=="constructor":
            self.sab_arg["this"] = self.class_name
            self.file_out.write("this,")
        self.copieleSubBody()
        
    def copieleParList(self):
        if self.token()!=")":
            var_type=self.token()
            self.adv()
            self.sab_arg[self.token()]=var_type
            self.file_out.write(self.token())
            self.adv()
        while self.token()!=")":
            self.file_out.write(",")
            self.adv()
            var_type=self.token()
            self.adv()
            self.sab_arg[self.token()]=var_type
            self.file_out.write(self.token())
            self.adv()
    def copieleSubBody(self):
        self.adv()
        while self.token()=="var":
            self.copieleVarDec()
            self.file_out.write(",")
        self.file_out.write("\n")
        if self.sab_type=="constructor":
            self.file_out.write("<-"+str(self.fild_num())+"\n"+"Memory.alloc"+"\n"+"->@this\n")
        self.copieleStatements()
        self.adv()
    def copieleVarDec(self):
        self.adv()
        vars_type=self.token()
        self.adv()
        self.sab_arg[self.token()]=vars_type
        self.file_out.write(self.token())
        self.adv()
        while self.token()!=";":
            self.adv()
            self.sab_arg[self.token()]=vars_type
            self.file_out.write(",")
            self.file_out.write(self.token())
            self.adv()
        self.adv()
    def copieleStatements(self):
        while self.token()!="}":
            if self.token()=="let":
                self.copieleLet()
            elif self.token()=="if":
                self.copieleIf()
            elif self.token()=="while":
                self.copieleWhile()
            elif self.token()=="do":
                self.copieleDo()
            elif self.token()=="return":
                self.copieleReturn()
                #self.file_out.write("</statements>")
                #self.file_out.write("</subroutineBody>")
                #self.file_out.write("</subroutineDec>")
                #self.file_out.write("</class>")
                #self.close()
    def copieleLet(self):
        self.adv()
        is_sab_var=self.token() in self.sab_arg
        if not(is_sab_var):
            is_filde=self.class_vars[self.token()][0]
            sm_name=self.class_vars[self.token()][1]
        else:
            is_filde=False
            sm_name="@"+self.token()
        self.adv()
        is_list=self.token()=="["
        if is_list:
            self.adv()
            self.copieleExp()
            self.adv()
            if is_filde:
                self.file_out.write("<-@this\n<-"+sm_name+"\n+\n[]\n+\n")
            else:
                self.file_out.write("<-"+sm_name+"\n+\n")
            self.adv()
            self.copieleExp()
            self.file_out.write("->[]\n")
        else:
            if is_filde:
                self.file_out.write("<-@this\n<-"+sm_name+"\n+\n")
                self.adv()
                self.copieleExp()
                self.file_out.write("->[]\n")
            else:
                self.adv()
                self.copieleExp()
                self.file_out.write("->"+sm_name+"\n")
        self.adv()
    def copieleIf(self):
        self.adv()
        self.adv()
        self.copieleExp()
        self.file_out.write("~\n?-->else."+str(self.leibl_caunter)+"\n")
        leibl = self.leibl_caunter
        self.leibl_caunter=self.leibl_caunter+1
        self.adv()
        self.adv()
        self.copieleStatements()
        self.adv()
        #??now we are here
        self.file_out.write("-->end_if."+str(leibl)+"\n")
        self.file_out.write("else."+str(leibl)+":\n")
        if self.token()=="else":
            self.adv()
            self.adv()
            self.copieleStatements()
            self.adv()
        self.file_out.write("end_if."+str(leibl)+":\n")
    def copieleWhile(self):
        self.adv()
        self.adv()
        self.file_out.write("while_strt."+str(self.leibl_caunter)+":\n")
        self.copieleExp()
        self.file_out.write("~\n?-->while_end."+str(self.leibl_caunter)+"\n")
        leibl = self.leibl_caunter
        self.leibl_caunter=self.leibl_caunter+1
        self.adv()
        self.adv()
        self.copieleStatements()
        self.adv()
        self.file_out.write("-->while_strt."+str(leibl)+"\n")
        self.file_out.write("while_end."+str(leibl)+":\n")
    def copieleDo(self):
        self.adv()
        self.copiele_sub_call()
        self.file_out.write("->tmp\n")
        self.adv()
    def copieleReturn(self):
        self.adv()
        if self.token()==";":
            self.file_out.write("<-0\n")
        else:
            self.copieleExp()
        self.file_out.write("<--\n")
        self.adv()
    def copieleExp(self):
        self.copieleTerm()
        while self.token() in compaler.op_dict:
            op=compaler.op_dict[self.token()]
            self.adv()
            self.copieleTerm()
            self.file_out.write(op+"\n")
    def copieleTerm(self):
        if self.token()=="(":
            self.adv()
            self.copieleExp()
            self.adv()
        elif self.token()=="-" or self.token()=="~":
            unary_op=compaler.unary_ops[self.token()]
            self.adv()
            self.copieleTerm()
            self.file_out.write(unary_op+"\n")
        elif self.nexst_token()==".":
            self.copiele_sub_call()
        elif self.nexst_token()=="(":
            self.copiele_sub_call()
        elif self.token_typ()=="integrConstant":
            self.file_out.write("<-"+self.token()+"\n")
            self.adv()
        elif self.token()=="true":
            self.file_out.write("<-1\n(-)\n")
            self.adv()
        elif self.token()=="false":
            self.file_out.write("<-0\n")
            self.adv()
        elif self.token()=="null":
            self.file_out.write("<-0\n")
            self.adv()
        elif self.token_typ()=="StringConstant":
            string=self.token()[1:-1]
            self.file_out.write("<-"+str(len(string))+"\nString.new\n")
            for char in string:
                self.file_out.write("<-"+str(ord(char))+"\nString.appendChar\n")
            self.adv()
        else:
            if self.token() in self.sab_arg:
                self.file_out.write("<-@"+self.token()+"\n")
            else:
                self.file_out.write("<-"+(self.class_vars[self.token()][1])+"\n")
                if self.class_vars[self.token()][0]:
                    self.file_out.write("<-@this\n+\n[]\n")
            self.adv()
            if self.token()=="[":
                self.adv()
                self.copieleExp()
                self.file_out.write("+\n[]\n")
                self.adv()
    def copieleExpList(self):
        if self.token()!=")":
            self.copieleExp()
            while self.token()!=")":
                self.adv()
                self.copieleExp()
    def copiele_sub_call(self):
        if self.nexst_token()=="(":
            sab_name=self.class_name+"."+self.token()
            self.file_out.write("<-@this\n")
            self.adv()
        else:
            if self.token() in self.sab_arg:
                call_class=self.sab_arg[self.token()]
                self.file_out.write("<-@"+self.token() + "\n")
            elif self.token() in self.class_vars:
                call_class=self.class_vars[self.token()][2]
                self.file_out.write("<-"+self.class_vars[self.token()][1] + "\n")
                if self.class_vars[self.token()][0]:
                    self.file_out.write("<-@this\n+\n[]\n")
            else:
                call_class=self.token()
            self.adv()
            self.adv()
            sab_name=call_class+"."+self.token()
            self.adv()
        self.adv()
        self.copieleExpList()
        self.file_out.write(sab_name+"\n")
        self.adv()
    def close(self):
        self.file_out.close()
def compale_file(file_name):
    f=compaler(file_name)
    f.copieleClass()
    f.close()

def compale_folder(fold):
    dir_list=os.listdir(fold)
    for f in dir_list:
        name,ext=os.path.splitext(f)
        if ext==".jack":
            compale_file(fold+"/"+name)
# REPAIR (oracle): the supplied file ends with two live calls --
#     compale_folder("C:/Users/Meir/Dropbox/.../11/Pong")
#     SM.translate_fold("C:/Users/Meir/Dropbox/.../11/Pong")
# -- executed at import time, against a path that exists only on the machine
# it was written on. So importing the module compiles somebody else's Pong,
# or raises. Removed, with the dozen commented-out calls above them; `run.py`
# takes the folder as an argument instead.
