import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CropMonitorComponent } from './crop-monitor.component';

describe('CropMonitorComponent', () => {
  let component: CropMonitorComponent;
  let fixture: ComponentFixture<CropMonitorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CropMonitorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CropMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
