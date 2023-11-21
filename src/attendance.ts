import puppeteer from "puppeteer";
import { getCreds, getSignInStatus, logger, setSignInStatus } from './constants';
import isReachable from "is-reachable";

let checkSignOut = false;

export async function attendence(userName:string,password:string,signIn:boolean){

    logger.info(""+signIn+getSignInStatus()+checkSignOut);

    if(signIn && getSignInStatus()) return;
    if(!signIn && !getSignInStatus() && checkSignOut) return;

    const browser = await puppeteer.launch({ headless: true,executablePath:`C:/Program Files/Google/Chrome/Application/chrome.exe` });
    const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
    // Open a new page/tab
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);

    // Navigate to a specific website
    try{
      await page.goto('https://keusautomation.greythr.com/'); // Replace with your desired website URL
    }
    catch(err){
      logger.info("failed to got url"+err);
    }
    await page.waitForSelector('#username')
    // Optional: Take a screenshot of the page
    await page.type("#username",userName);
    await page.type("#password",password)
    let button = await page.$x(`//button[contains(text(), 'Log in')]`);
    //@ts-ignore
    let btn:HTMLButtonElement = button[0];
    await btn.click()
    await page.waitForNavigation({
      waitUntil: ['networkidle0','domcontentloaded','load'],
    });
    let button_sign = await page.evaluateHandle(():Promise<HTMLButtonElement>=>{
      // @ts-ignore
      return  document.querySelector(`body > app > ng-component > div > div > div.container-fluid.app-container.px-0 > div > ghr-home > div.page.page-home.ng-star-inserted > div > gt-home-dashboard > div > div:nth-child(2) > gt-component-loader > gt-attendance-info > div > div > div.btn-container.mt-3x.flex.flex-row-reverse.justify-between.ng-star-inserted > gt-button:nth-child(1)`).shadowRoot.querySelector("button")
    });

    // await button_sign.click();
    let text = `${await (await button_sign?.getProperty('textContent'))?.jsonValue()}`
    if(text == "Sign Out"){
        if(!signIn){
          await button_sign.click();  //sign out
          setSignInStatus(false);
          checkSignOut = true;
          logger.info("signed out "+userName)
          console.log("signed out "+userName)
       }
       else{
        logger.info("already signed in "+userName);
        console.log("already signed in "+userName);
        setSignInStatus(true);
       }
    }
    else{
      if(signIn){
        await button_sign.click();  //sign in
        setSignInStatus(true);
        logger.info("signed in "+userName)
        console.log("signed in "+userName)
      }
      else{
        logger.info("already signed out "+userName);
        console.log("already signed out "+userName);
        setSignInStatus(false);
        checkSignOut = true;
      }
    }

      await browser.close();
}

export async function checkAttendence(date:Date){
    let hour = date.getHours();
    let creds = getCreds();
    logger.info("from cron"+JSON.stringify(creds)+hour+date);
    console.log("from cron"+JSON.stringify(creds)+hour+date)
    try{

      if(!await isReachable("www.google.com",{timeout:5000})) {
        logger.info("laptop is offline can't proceed to login");
        console.log("laptop is offline can't proceed to login");
        return;
    }

      for(const cred of creds){
        if(hour>= (cred?.Out || 20)){
          await attendence(cred.userName,cred.password,false);
        }else if(hour> (cred.In || 9)){
          await attendence(cred.userName,cred.password,true);
        }
      }
    }
    catch(err){
      logger.info("failed to check attendence"+err);
    }
}