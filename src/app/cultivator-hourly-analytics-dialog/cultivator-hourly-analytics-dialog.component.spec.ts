import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CultivatorHourlyAnalyticsDialogComponent } from './cultivator-hourly-analytics-dialog.component';

describe('CultivatorHourlyAnalyticsDialogComponent', () => {
  let component: CultivatorHourlyAnalyticsDialogComponent;
  let fixture: ComponentFixture<CultivatorHourlyAnalyticsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CultivatorHourlyAnalyticsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CultivatorHourlyAnalyticsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
