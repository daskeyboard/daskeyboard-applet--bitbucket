const q = require('daskeyboard-applet');

const logger = q.logger;
const queryUrlBase = 'https://api.bitbucket.org/2.0';

class Bitbucket extends q.DesktopApp {
  constructor() {
    super();
    // run every 30 secondes
    this.pollingInterval = 30 * 1000;
  }

  async applyConfig() {
    logger.info("Bitbucket initialisation.");

    // Array to keep in mind the projects name and update date.
    this.updated_on = {};
    this.pullrequestNumber = {};

    // User Name
    this.userName = this.config.userName;

    // Only if userName is definded
    if(this.userName){

      // first get all the user projects
      await this.getAllProjects().then(async projects => {

        logger.info("Let's configure the project table by getting the time.");

        logger.info("Response projects: "+JSON.stringify(projects));

        for (let project of projects.values) {
          // Get update_on for each project
          this.updated_on[project.name] = project.updated_on;

          // Initialise pull requests number
          if((this.config.trigger != "updates")){
            await this.getPullRequests(project.slug).then(pullrequest => {
              this.pullrequestNumber[project.name] = pullrequest.size;
            });
          }
        }

        logger.info("This is the initialised updated_on board: "+JSON.stringify(this.updated_on));

        if((this.config.trigger != "updates")){
          logger.info("This is the pull request number board: "+JSON.stringify(this.pullrequestNumber));
        }


      })
      .catch(error => {
        logger.error(
          `Got error sending request to service: ${JSON.stringify(error)}`);
      });

    }else{
      logger.info("UserName is not defined.");
    }

  }

  // Get all the user projects
  async getAllProjects() {

    // return this.getBitbucketAccessToken().then(accessToken => {
    //   // save the token
    //   this.bitbucketAccessToken = accessToken;
    //   // add token to request option
    //   options = {
    //     ...options, headers: {

    //       'grant_type': 'refresh_token'
    //     }
    //   }
    // })
    const query = `/repositories/${this.userName}`;
    logger.info("This is the query for getAllProjects(): "+query);
    const proxyRequest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: queryUrlBase + query
    });
    const response =  this.oauth2ProxyRequest(proxyRequest);
    if(response){
      logger.info("This is the first response: "+JSON.stringify(response));
      // return response;
    }
    // Otherwise try to refresh token
    const proxyRequestTest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: 'https://bitbucket.org/site/oauth2/access_token',
      method: 'POST'

    })
    proxyRequestTest.refreshOauth2AccessToken().then(proxyResponse => {
      logger.info("This is the proxyResponse"+JSON.stringify(proxyResponse));
      logger.info("Here, need to update the authorization key.");
    });

    // Try another time to make a request
    proxyRequest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: queryUrlBase + query
    });
    return this.oauth2ProxyRequest(proxyRequest);
  }

  // Get the pull request
  async getPullRequests(repoSlug) {
    const query = `/repositories/${this.userName}/${repoSlug}/pullrequests`;
    logger.info("This is the query for getPullRequests(): "+query);
    const proxyRequest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: queryUrlBase + query
    });
    const response =  this.oauth2ProxyRequest(proxyRequest);
    if(response){
      logger.info("This is the first response: "+JSON.stringify(response));
      // return response;
    }
    // Otherwise try to refresh token
    const proxyRequestTest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: 'https://bitbucket.org/site/oauth2/access_token',
      method: 'POST'

    })
    proxyRequestTest.refreshOauth2AccessToken().then(proxyResponse => {
      logger.info("This is the proxyResponse"+JSON.stringify(proxyResponse));
      logger.info("Here, need to update the authorization key.");
    });

    // Try another time to make a request
    proxyRequest = new q.Oauth2ProxyRequest({
      apiKey: this.authorization.apiKey,
      uri: queryUrlBase + query
    });
    return this.oauth2ProxyRequest(proxyRequest);
  }

  async run() {
    logger.info("Bitbucket running.");
    return this.getAllProjects().then(async projects => {
      let triggered = false;
      let message = [];
      let body;
      this.url = "";
      var notification = 0;

      for (let project of projects.values) {

        // If there is a new created project (means board equals to undefined)
        // We initialise the project's date
        if(!this.updated_on[project.name]){
          this.updated_on[project.name] = project.updated_on;
        }

        // logger.info("Testing update on: "+JSON.stringify(project.name));

        // Test if a project has been updated
        if( (project.updated_on > this.updated_on[project.name]) && (this.config.trigger != "pullrequests")){

          // Need to send a signal         
          triggered=true;

          logger.info("Got an update in: " + JSON.stringify(project.name));

          // Need to update the time of the project which got an update
          this.updated_on[project.name] = project.updated_on;

          // Update signal's message
          message.push(`Update in <b>${project.name}</b> project.`);

          logger.info("This is the link: " + project.links.html.href);
          this.url = project.links.html.href;

          //   // Update url:
          //   // if there are several notifications on different projects:
          //   // the url needs to redirect on the projects page
          //   if(notification >= 1){
          //     this.url = `https://3.basecamp.com/${this.userName}/projects/`;
          //   }else{
          //     this.url = project.app_url;
          //   }
          //   notification = notification +1;

         }

         // Test if there is a new pull request
         if((this.config.trigger != "updates")){
          body = await this.getPullRequests(project.slug);
          // logger.info("Current pull request number: "+JSON.stringify(body.size));
          // logger.info("Old pull request number: "+this.pullrequestNumber[project.name]);

          // If there is a pull request at least
          if(body.size > this.pullrequestNumber[project.name]){
            logger.info("New pull request.");
            // Need to send a signal         
            triggered=true;
            // Update signal's message
            message.push(`New pull request in <b>${project.name}</b> project.`);
            // Need to update link
            this.url = body.values[0].links.html.href;
          }

          // Need to update value
          this.pullrequestNumber[project.name] = body.size;
         }

      }


      if (triggered) {
        logger.info("Got udpate. Sending signal.");
        return new q.Signal({
          points: [
            [new q.Point(this.config.color, this.config.effect)]
          ],
          name: `Bitbucket`,
          message: message.join("<br>"),
          link: {
            url: this.url,
            label: 'Show in Bitbucket',
          },
        });
      } else {
        return null;
      }
    }).catch(error => {
      logger.error(
        `Got error sending request to service: ${JSON.stringify(error)}`);
      
      if(`${error.message}`.includes("getaddrinfo")){
        // Do not send signal error when getting internet connection error.
        // return q.Signal.error(
        //   'The Bitbucket service returned an error. <b>Please check your internet connection</b>.'
        // );
      }else{
        return q.Signal.error([
          'The Bitbucket service returned an error. <b>Please check your user ID and account</b>.',
          `Detail: ${error.message}`]);
      }
    });
  }
}


module.exports = {
  Bitbucket: Bitbucket
}

const applet = new Bitbucket();