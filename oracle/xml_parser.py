import tokenazr
class parser:
    def __init__(self,file_name):
        self.tokens=tokenazr.tokenaiz(file_name+".jack")
        self.file_out=open(file_name+".xml","w")
        self.pos=0
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
    def copieleClass(self):
        self.file_out.write("<class>")
        self.write_token()
        self.write_token()
        self.write_token()
        while (self.token()=="static") or (self.token()=="fild"):
            self.copieleClassVarDec()
        #self.file_out.write("</class>")
        #self.close()
        while (self.token()!="}"):
            self.copieleSubDec()
        self.write_token()
        self.file_out.write("</class>")
        #self.close()
    def copieleClassVarDec(self):
        self.file_out.write("<classVarDec>")
        while self.token()!=";":
            self.write_token()
        self.write_token()
        self.file_out.write("</classVarDec>")
    def copieleSubDec(self):
        self.file_out.write("<subroutineDec>")
        self.write_token()
        self.write_token()
        self.write_token()
        self.write_token()
        self.copieleParList()
        self.write_token()
        self.copieleSubBody()
        self.file_out.write("</subroutineDec>")
    def copieleParList(self):
        self.file_out.write("<parameterList>")
        while self.token()!=")":
            self.write_token()
        self.file_out.write("</parameterList>")
    def copieleSubBody(self):
        self.file_out.write("<subroutineBody>")
        self.write_token()
        while self.token()=="var":
            self.copieleVarDec()
        self.copieleStatements()
        self.write_token()
        self.file_out.write("</subroutineBody>")
    def copieleVarDec(self):
        self.file_out.write("<varDec>")
        while self.token()!=";":
            self.write_token()
        self.write_token()
        self.file_out.write("</varDec>")
    def copieleStatements(self):        
        self.file_out.write("<statements>")
        
        

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

                pass
        self.file_out.write("</statements>")
    def copieleLet(self):
        self.file_out.write("<letStatement>")
        self.write_token()
        self.write_token()
        if self.token()=="[":
            self.write_token()
            self.copieleExp()
            self.write_token()
        self.write_token()
        self.copieleExp()
        self.write_token()
        self.file_out.write("</letStatement>")
    def copieleIf(self):
        self.file_out.write("<ifStatement>")
        self.write_token()
        self.write_token()
        self.copieleExp()
        self.write_token()
        self.write_token()
        self.copieleStatements()
        self.write_token()
        if self.token()=="else":
            self.write_token()
            self.write_token()
            self.copieleStatements()
            self.write_token()
        self.file_out.write("</ifStatement>")
    def copieleWhile(self):
        self.file_out.write("<whileStatement>")
        self.write_token()
        self.write_token()
        self.copieleExp()
        self.write_token()
        self.write_token()
        self.copieleStatements()
        self.write_token()
        self.file_out.write("</whileStatement>")
    def copieleDo(self):
        self.file_out.write("<doStatement>")     
        self.write_token()
        #self.file_out.write("</doStatement>")
        #self.file_out.write("</statements>")
        #self.file_out.write("</subroutineBody>")
        #self.file_out.write("</subroutineDec>")
        #self.file_out.write("</class>")
        #self.close()

        #pass

        
        self.copiele_sub_call()
        self.write_token()
        self.file_out.write("</doStatement>")
    def copieleReturn(self):
        self.file_out.write("<returnStatement>")
        self.write_token()
        if self.token()!=";":
            self.copieleExp()
        self.write_token()
        self.file_out.write("</returnStatement>")
    def copieleExp(self):
        self.file_out.write("<expression>")
        self.copieleTerm()
        op_list=list("+-*/&|<>=")
        while self.token() in op_list:
            self.write_token()
            self.copieleTerm()
        self.file_out.write("</expression>")
    def copieleTerm(self):
        self.file_out.write("<term>")
        if self.token()=="(":
            self.write_token()
            self.copieleExp()
            self.write_token()
        elif self.token()=="-" or self.token()=="~":
            self.write_token()
            self.copieleTerm()
        elif self.nexst_token==".":
            self.copiele_sub_call()
        elif self.nexst_token=="(":
            self.copiele_sub_call()
        elif self.nexst_token=="[":
            self.write_token()
            self.write_token()
            self.copieleExp()
            self.write_token()
        else:
            self.write_token()
        self.file_out.write("</term>")
    def copieleExpList(self):
        self.file_out.write("<expressionList>")
        if self.token()!=")":
            self.copieleExp()
            while self.token()!=")":
                self.write_token()
                self.copieleExp()
        self.file_out.write("</expressionList>")
    def copiele_sub_call(self):
        self.write_token()
        if self.token()==".":
            self.write_token()
            self.write_token()
        self.write_token()
        self.copieleExpList()
        self.write_token()
    def test_tokenazer(self):
        self.file_out.write("<tokens>")
        while self.pos<len(self.tokens):
            self.write_token()
        self.file_out.write("</tokens>")
    def close(self):
        self.file_out.close()
def pars_file(file_name):
    f=parser(file_name)
    f.copieleClass()
    f.close()
def tokcenais_file(file_name):
    f=parser(file_name)
    f.test_tokenazer()
    f.close()
#tokcenais_file("C:/Dropbox/gusts/Meir/code/nand2tetris/projects/first_round/10/ExpressionLessSquare/Main_test.jack")
#tokcenais_file("C:/Users/Meir/Dropbox/code/nand2tetris/projects/first_round/10/ExpressionLessSquare/Main_test")
pars_file("C:/Users/Meir/Dropbox/code/nand2tetris/projects/first_round/10/ExpressionLessSquare/Main_test")
#C:\Users\Meir\Dropbox\code\nand2tetris\projects\first_round\10\ExpressionLessSquare