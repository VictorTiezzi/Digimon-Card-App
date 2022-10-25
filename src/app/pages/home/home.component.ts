import { Component, OnDestroy, OnInit } from '@angular/core';
import { DataSnapshot } from '@angular/fire/compat/database/interfaces';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ConfirmationService, MessageService } from 'primeng/api';
import { first, Subject, takeUntil } from 'rxjs';
import * as uuid from 'uuid';
import { ADMINS, IUser, RIGHTS } from '../../../models';
import { IBlog } from '../../../models/interfaces/blog-entry.interface';
import { AuthService } from '../../service/auth.service';
import { DatabaseService } from '../../service/database.service';

@Component({
  selector: 'digimon-home',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  allBlogEntries: IBlog[] = [];
  blogEntries: IBlog[] = [];
  blogEntriesHidden: IBlog[] = [];

  user: IUser | null;
  rights = RIGHTS;

  editView = false;
  currentBlog: IBlog;
  currentTitle = 'Empty Title';
  currentQuill: any[] = [];

  private onDestroy$ = new Subject();
  constructor(
    private authService: AuthService,
    private dbService: DatabaseService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private router: Router,
    private store: Store
  ) {}

  ngOnInit() {
    this.user = this.authService.userData;
    this.authService.authChange
      .pipe(takeUntil(this.onDestroy$))
      .subscribe(() => (this.user = this.authService.userData));

    this.dbService
      .loadBlogEntries()
      .pipe(first())
      .subscribe((r) => {
        const value: DataSnapshot = r;
        if (!value) {
          return;
        }
        const entries: IBlog[] = Object.values(value.val());

        this.allBlogEntries = entries;
        this.blogEntriesHidden = entries.filter((entry) => !entry.approved);
        this.blogEntries = entries.filter((entry) => entry.approved);
      });
  }

  ngOnDestroy() {
    this.onDestroy$.next(true);
  }

  newEntry() {
    const newBlog: IBlog = {
      uid: uuid.v4(),
      date: new Date(),
      title: 'Empty Entry',
      text: '',
      approved: false,
      author: this.user!.displayName,
      authorId: this.user!.uid,
      category: 'Tournament Report',
    };
    this.blogEntriesHidden.push(newBlog);
    this.dbService.saveBlogEntry(newBlog);
    this.messageService.add({
      severity: 'success',
      summary: 'Blog-Entry created!',
      detail: 'New Blog-Entry was created successfully!',
    });
  }

  open(blog: IBlog) {
    this.router.navigateByUrl('blog/' + blog.uid);
  }

  approve(blog: IBlog) {
    blog.approved = true;
    this.blogEntriesHidden = this.blogEntriesHidden.filter(
      (entry) => entry.uid !== blog.uid
    );
    this.blogEntries = this.blogEntries.filter(
      (entry) => entry.uid !== blog.uid
    );
    this.blogEntries.push(blog);
    this.dbService.saveBlogEntry(blog);
  }

  hide(blog: IBlog) {
    blog.approved = false;
    this.blogEntriesHidden = this.blogEntriesHidden.filter(
      (entry) => entry.uid !== blog.uid
    );
    this.blogEntries = this.blogEntries.filter(
      (entry) => entry.uid !== blog.uid
    );
    this.blogEntriesHidden.push(blog);
    this.dbService.saveBlogEntry(blog);
  }

  edit(blog: IBlog) {
    this.editView = true;
    this.currentQuill = blog.text;
    this.currentTitle = blog.title;
    this.currentBlog = blog;
  }

  delete(blog: IBlog, event: any) {
    this.confirmationService.confirm({
      target: event!.target!,
      message:
        'You are about to permanently delete your this Blog-Entry. Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.blogEntriesHidden = this.blogEntriesHidden.filter(
          (entry) => entry.uid !== blog.uid
        );
        this.blogEntries = this.blogEntries.filter(
          (entry) => entry.uid !== blog.uid
        );
        this.dbService.deleteBlogEntry(blog.uid);
        this.messageService.add({
          severity: 'success',
          summary: 'Blog-Entry deleted!',
          detail: 'The Blog-Entry was deleted successfully!',
        });
      },
      reject: () => {},
    });
  }

  save() {
    this.currentBlog.title = this.currentTitle;
    this.currentBlog.text = this.currentQuill;
    this.currentBlog.date = new Date();

    this.dbService.saveBlogEntry(this.currentBlog);

    this.messageService.add({
      severity: 'success',
      summary: 'Blog-Entry saved!',
      detail: 'The Blog-Entry was saved successfully!',
    });
    this.editView = false;
  }

  isAdmin(): boolean {
    return !!ADMINS.find((user) => {
      if (this.user?.uid === user.id) {
        return user.admin;
      }
      return false;
    });
  }

  showWrite(): boolean {
    if (this.isAdmin()) {
      return true;
    }

    return !!ADMINS.find((user) => {
      if (this.user?.uid === user.id) {
        return user.writeBlog;
      }
      return false;
    });
  }

  showButtons(): boolean {
    if (this.isAdmin()) {
      return true;
    }

    const writeRights = !!ADMINS.find((user) => {
      if (this.user?.uid === user.id) {
        return user.writeBlog;
      }
      return false;
    });

    const entryWritten = !!this.allBlogEntries.find(
      (blog) => blog.authorId === this.user?.uid
    );
    return writeRights ? entryWritten : false;
  }

  showEdit(blog: IBlog): boolean {
    if (this.isAdmin()) {
      return true;
    }

    const writeRights = !!ADMINS.find((user) => {
      if (this.user?.uid === user.id) {
        return user.writeBlog;
      }
      return false;
    });

    return writeRights ? blog.authorId === this.user?.uid : false;
  }
}
