import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CultivatorDailyAnalyticsDialogComponent } from './cultivator-daily-analytics-dialog.component';

describe('CultivatorDailyAnalyticsDialogComponent', () => {
  let component: CultivatorDailyAnalyticsDialogComponent;
  let fixture: ComponentFixture<CultivatorDailyAnalyticsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CultivatorDailyAnalyticsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CultivatorDailyAnalyticsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
