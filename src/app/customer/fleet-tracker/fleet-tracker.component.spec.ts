import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CultivatorTrackerComponent } from './cultivator-tracker.component';

describe('CultivatorTrackerComponent', () => {
  let component: CultivatorTrackerComponent;
  let fixture: ComponentFixture<CultivatorTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CultivatorTrackerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CultivatorTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
