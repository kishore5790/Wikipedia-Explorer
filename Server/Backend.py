#!/usr/bin/python
import re
import json
import time
from threading import Thread,Timer
from http.server import BaseHTTPRequestHandler,HTTPServer
import urllib.request
from os import curdir,sep

PORT_NUMBER = 8080
# To handle requests 
class myHandler(BaseHTTPRequestHandler) :

	# Handler for GET requests
	def do_GET(self) :
		htmlData = "Request not handled"
		self.send_response(200)
		self.send_header('Content-type','text/html')
		self.end_headers()      
		try :
			if self.path.endswith("home") :
				htmlFile = open(curdir + sep + "/Frontend.html",encoding='UTF-8')				
				# Reading requested HTML content
				htmlData = htmlFile.read()
				
				# Adding JavaScript to HTML content
				scripts = re.findall("(<script[^>]*src\s*=\s*[\'\"]([^\'\"]+)[\'\"][^>]*>)",htmlData)
				for script in scripts :
					scriptFile = open(curdir + sep + str(script[1]),encoding='UTF-8')
					scriptData = "<script type=\'text/javascript\'>" + scriptFile.read()
					scriptData = re.sub(r"\\'","'",scriptData)
					htmlData = htmlData.replace(script[0],scriptData)
				
				# Adding CSS to HTML content
				styles = re.findall("(<link[^>]*href\s*=\s*[\'\"]([^\'\"]+)[\'\"][^>]*>)",htmlData)
				for style in styles :
					cssFile = open(curdir + sep + str(style[1]),encoding='UTF-8')
					cssData = "<style type=\'text/css\'>" + cssFile.read() + "</style>"
					htmlData = htmlData.replace(style[0],cssData)
					
		except IOError :
			htmlData = "Service unavailable"
			
		# Sending the HTML message
		self.wfile.write(htmlData.encode())
		return
    
    # Handler for POST requests
	def do_POST(self) :
		contentLen = int(self.headers['content-length'])
		reqBody = self.rfile.read(contentLen).decode('UTF-8')
			
		self.send_response(200)
		self.end_headers()
		path = self.path
		result = re.search("(search)|(expand_article)|(expand_category)",path)
		
		response = ""
		service = ""
		if result : service = result.group()
		if service == "search" :
			response = json.dumps(search(reqBody),ensure_ascii=False)
		elif service == "expand_article" :
			print ("Expand_Article "+reqBody)
			response = json.dumps(exploreArticle(reqBody),ensure_ascii=False)
		elif service == "expand_category" :
			print ("Expand_Category "+reqBody)
			response = json.dumps(exploreCategory(reqBody),ensure_ascii=False)
		else :
			response = "Service unavailable"
		
		self.wfile.write(response.encode())
		return
		
# Returns a list of dicts, 1 dict for each article
def search(keyword) :
	url = r"http://wdm.cs.waikato.ac.nz:8080/services/search?query="+keyword+r"&responseFormat=json&complex=true"
	searchResult = serviceCall(url)
	senses = searchResult["labels"][0]["senses"]
	response = []
	for sense in senses :
		art_id = sense['id']
		art_title = sense['title']
		art_obj = exploreArticle(json.dumps({'id':art_id,'hiddenChildren':'no','index':0}))
		response.append(art_obj)
	return response
	
def exploreArticle(reqBody) :
	reqParams = json.loads(reqBody)
	art_id = reqParams['id']
	hiddenChildren = reqParams['hiddenChildren']
	index = reqParams['index']
	url = r"http://wdm.cs.waikato.ac.nz:8080/services/exploreArticle?id="+str(art_id)+r"&responseFormat=json&definition=true&parentCategories=true"
	exArtResult = serviceCall(url)
	response = {'id':art_id,'type':'Article','title':exArtResult['title'],'index':index}
	response['definition'] = re.sub(r"<[^>]*>","",exArtResult['definition'])
	categories = []
	if exArtResult['totalParentCategories'] > 0 : categories += exArtResult['parentCategories']
	if len(categories) > 5 : categories = categories[0:5]
	for category in categories :
		category['type'] = 'Category'
	if(hiddenChildren.lower() == "yes") :
		response['_children'] = categories
	elif (hiddenChildren.lower() == "no") :
		response['children'] = categories
	return response

def exploreCategory(reqBody) :
	cat_id = json.loads(reqBody)
	url = r"http://wdm.cs.waikato.ac.nz:8080/services/exploreCategory?id="+str(cat_id)+r"&responseFormat=json&parentCategories=true&childCategories=true&childCategoryMax=2&childArticles=true&childArticleMax=3"
	exCatResult = serviceCall(url)
	response = []
	if exCatResult['totalParentCategories'] > 0 : response += exCatResult['parentCategories']
	if len(response) > 2 : response = response[0:2]
	if exCatResult['totalChildCategories'] > 0 : response += exCatResult['childCategories']
	for category in response :
		category['type'] = 'Category';
	articles = []
	if exCatResult['totalChildArticles'] > 0 : articles += exCatResult['childArticles']
	for article in articles :
		article['type'] = 'Article'
	response += articles;
	return response

# Returns a list or dictionary
def serviceCall(url) :
	query = urllib.request.urlopen(url)
	jsonData = query.read().decode('UTF-8')
	response = json.loads(jsonData)
	return response

def main() :
	try :
		# Create web server and define handler to manage request
		server = HTTPServer(('', PORT_NUMBER), myHandler)
		print ('Started httpserver on port ' , PORT_NUMBER)
		server.serve_forever()
	except KeyboardInterrupt :
		print ('^C received, shutting down the web server')
		server.socket.close()
		
if __name__ == "__main__" :
	main()
