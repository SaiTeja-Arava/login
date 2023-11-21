import fs from "fs/promises";
import {EventLogger} from "node-windows"

export interface Creds{
    userName: string;
    password: string;
    In?: number;
    Out?: number;
}

export const logger = new EventLogger({source:"login-script"});

const credFilePath = __dirname+"/../creds.json";


let signInStatus = false;

let creds :Creds[];

export function getSignInStatus(){
    return signInStatus;
}

export function setSignInStatus(s:boolean){
    signInStatus = s;
}


export function getCreds():Creds[]{
    return creds;
}

export async function readCredentials():Promise<Creds[]>{
    let credsJson = await fs.readFile(credFilePath,{encoding:"utf-8"});
    try{
        creds = await JSON.parse(credsJson);
    }catch(e){
        creds = [];
        logger.info("failed to parse json"+e);
    }
    console.log("json from read",creds);
    return creds;

}

export async function updateCredentials(nc:Creds[]){
    creds = nc;
    let data =JSON.stringify(nc);
    return await fs.writeFile(credFilePath,data);
}

export async function initializeJson(){
    await updateCredentials(await readCredentials());
}
