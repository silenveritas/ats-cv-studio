import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {collectionSchema} from '../lib/resume-collection';
import {MAX_COLLECTION_BYTES,type CvSnapshot,type saveRequestSchema} from '../lib/cv-database';
import type {z} from 'zod';
import {newToken,tokenHash} from './auth';
export type User={id:string;email:string};
type UserRow=User&{password_hash:string};
type CollectionRow={collection_json:string;revision:number;mutation_id:string};
export function openDatabase(file:string){
 const path=resolve(file);mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const db=new DatabaseSync(path,{timeout:5000});chmodSync(path,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
 CREATE TABLE IF NOT EXISTS cv_collections(owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,collection_json TEXT NOT NULL,revision INTEGER NOT NULL,mutation_id TEXT NOT NULL,updated_at TEXT NOT NULL);
 PRAGMA user_version=1;`);
 const userByEmail=(email:string)=>db.prepare('SELECT id,email,password_hash FROM users WHERE email=?').get(email) as UserRow|undefined;
 const createUser=(email:string,passwordHash:string):User=>{const id=randomUUID();db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id,email,passwordHash,new Date().toISOString());return {id,email};};
 const startSession=(id:string)=>{db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());const token=newToken();db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token),id,Date.now()+30*24*3600*1000);return token;};
 const sessionUser=(token:string|null):User|null=>token?(db.prepare('SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token),Date.now()) as User|undefined)||null:null;
 const endSession=(token:string|null)=>{if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));};
 const read=(ownerId:string):CvSnapshot=>{const row=db.prepare('SELECT collection_json,revision,mutation_id FROM cv_collections WHERE owner_id=?').get(ownerId) as CollectionRow|undefined;return {ownerId,collection:row?collectionSchema.parse(JSON.parse(row.collection_json)):null,revision:row?.revision??0,mutationId:row?.mutation_id??null};};
 const save=(ownerId:string,input:z.infer<typeof saveRequestSchema>)=>{
  db.exec('BEGIN IMMEDIATE');
  try{
   const previous=read(ownerId);
   if(previous.mutationId===input.mutationId){db.exec('COMMIT');return {conflict:false,snapshot:previous};}
   if(previous.revision!==input.revision){db.exec('COMMIT');return {conflict:true,snapshot:previous};}
   const payload=JSON.stringify(input.collection);if(Buffer.byteLength(payload)>MAX_COLLECTION_BYTES)throw new RangeError('Collection too large');
   const revision=previous.revision+1;
   db.prepare(`INSERT INTO cv_collections(owner_id,collection_json,revision,mutation_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET collection_json=excluded.collection_json,revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at`).run(ownerId,payload,revision,input.mutationId,new Date().toISOString());
   db.exec('COMMIT');return {conflict:false,snapshot:{ownerId,collection:input.collection,revision,mutationId:input.mutationId}};
  }catch(error){db.exec('ROLLBACK');throw error;}
 };
 return {db,userByEmail,createUser,startSession,sessionUser,endSession,read,save};
}
