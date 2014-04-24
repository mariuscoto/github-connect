# Github-connect

Is the app that quantifies your contributions to the open-source world,
helps you engage with other projects and bake new project ideas.

You can try out the app at [http://github-connect.herokuapp.com](http://github-connect.herokuapp.com/).

This is still in beta, so your [feedback](http://github-connect.herokuapp.com/contact) is welcome.


## Setup

### Easy install
For a quick setup, just run **make setup** in the root directory. This should
work on both Linux and OSX. Then **make run** will start the db and app at
[http://localhost:3000](http://localhost:3000).

### Manual setup
1. Install nodejs (preferably from own repo) and npm:
        add-apt-repository ppa:chris-lea/node.js && apt-get update
        apt-get install nodejs

2. Install mongodb. Needed for our database:
        apt-get install mongodb

  For OSX, I recommand using [MacPorts](http://www.macports.org/) for an easy install:
        port install mongodb

3. Set node environment ($NODE_ENV):
        NODE_ENV=development

4. Install all node modules. A list is available further down.
        npm install

5. Start mongod and import testing database:
        mongod &
        mongorestore -d github-connect ghconnect_db/github-connect

6. Run mongod and start the app. Then visit [http://localhost:3000](http://localhost:3000).
        mongod &
        node app.js


## Dependencies
This is a list of the modules we use (package.json):

* [express](https://www.npmjs.org/package/express) - web development framework
* [everyauth](https://www.npmjs.org/package/everyauth) - authentication solution
* [connect](https://www.npmjs.org/package/connect) - high performance middleware framework
* [jade](https://www.npmjs.org/package/jade) - Jade template engine
* [mongoose](https://www.npmjs.org/package/mongoose) - MongoDB ODM
* [markdown](https://www.npmjs.org/package/markdown) - Markdown parser for javascript
* [nodemailer](https://www.npmjs.org/package/nodemailer) - send emails

  Use package.json to install them all:
        npm install package.json


### Happy coding !
