import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

EMPTY={'version':2,'profile':None,'plan':None,'logs':[],'messages':[],'knowledge':[]}
class Store:
    def __init__(self, directory):
        self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True)
        try:os.chmod(self.directory,0o700)
        except OSError:pass
        self.path=self.directory/'movemate.sqlite3'
        self.lock=threading.RLock()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            db.execute("INSERT OR IGNORE INTO kv VALUES ('state', ?)",(json.dumps(EMPTY),))
            db.execute("INSERT OR IGNORE INTO kv VALUES ('revision', '0')")
        try:os.chmod(self.path,0o600)
        except OSError:pass
    @contextmanager
    def connect(self):
        db=sqlite3.connect(str(self.path),timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()
    def get(self,key,default=None):
        with self.connect() as db:row=db.execute('SELECT value FROM kv WHERE key=?',(key,)).fetchone()
        return json.loads(row[0]) if row else default
    def put(self,key,value):
        with self.connect() as db:db.execute('INSERT OR REPLACE INTO kv VALUES (?,?)',(key,json.dumps(value,ensure_ascii=False)))
    def state(self):
        with self.lock:return {'state':self.get('state',EMPTY),'revision':self.get('revision',0)}
    def update(self,state,revision):
        with self.lock:
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                current=json.loads(db.execute("SELECT value FROM kv WHERE key='revision'").fetchone()[0])
                if revision!=current:return None
                db.execute("UPDATE kv SET value=? WHERE key='state'",(json.dumps(state,ensure_ascii=False),))
                db.execute("UPDATE kv SET value=? WHERE key='revision'",(str(current+1),))
                return current+1
    def healthy(self):
        with self.connect() as db:return db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
